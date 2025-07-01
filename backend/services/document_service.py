# backend/services/document_service.py
from datetime import datetime, timezone , timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_ , desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import or_

import uuid
import os
import json
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import black, darkblue, gray, red
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate

from models.extended_models import Document, DocumentType, Rental, Client, Property, Organization
from schemas.document import DocumentCreate, DocumentUpdate
from schemas.property import PropertyType
from schemas.rental import RentalType
from schemas.client import ClientCreate, ClientUpdate



class DocumentService:
    """Сервис для управления документами"""
    
    @staticmethod
    def get_document_by_id(
        db: Session, 
        document_id: uuid.UUID, 
        organization_id: uuid.UUID
    ) -> Optional[Document]:
        """Получить документ по ID с проверкой принадлежности к организации"""
        return db.query(Document).filter(
            and_(
                Document.id == document_id,
                Document.organization_id == organization_id
            )
        ).first()
    
    @staticmethod
    def create_document(
        db: Session,
        document_data: DocumentCreate,
        created_by: uuid.UUID,
        organization_id: uuid.UUID
    ) -> Document:
        """Создать новый документ"""
        
        # Генерируем номер документа
        document_number = DocumentService._generate_document_number(
            db, organization_id, document_data.document_type
        )
        
        document = Document(
            id=uuid.uuid4(),
            organization_id=organization_id,
            created_by=created_by,
            document_number=document_number,
            **document_data.dict()
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        return document
    
    @staticmethod
    def update_document(
        db: Session,
        document: Document,
        document_data: DocumentUpdate
    ) -> Document:
        """Обновить документ"""
        
        update_data = document_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(document, field, value)
        
        document.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(document)
        
        return document
    
    @staticmethod
    def sign_document(
        db: Session,
        document: Document,
        signed_by: uuid.UUID,
        signature_data: Dict[str, Any]
    ):
        """Подписать документ"""
        
        document.is_signed = True
        document.signed_at = datetime.now(timezone.utc)
        document.signature_data = {
            "signed_by": str(signed_by),
            "signed_at": datetime.now(timezone.utc).isoformat(),
            "signature_type": signature_data.get("type", "digital"),
            "signature_hash": signature_data.get("hash"),
            "additional_data": signature_data.get("additional_data", {})
        }
        document.updated_at = datetime.now(timezone.utc)
        
        db.commit()
    
    @staticmethod
    def generate_rental_contract(
        db: Session,
        rental: Rental,
        created_by: uuid.UUID
    ) -> Document:
        """Сгенерировать договор аренды"""
        
        # Подготавливаем данные для договора
        contract_data = {
            "rental_id": str(rental.id),
            "property_name": rental.property.name,
            "property_address": rental.property.address or "",
            "client_name": f"{rental.client.first_name} {rental.client.last_name}",
            "client_phone": rental.client.phone or "",
            "client_email": rental.client.email or "",
            "rental_type": rental.rental_type.value,
            "start_date": rental.start_date.isoformat(),
            "end_date": rental.end_date.isoformat(),
            "total_amount": rental.total_amount,
            "deposit": rental.deposit,
            "guest_count": rental.guest_count,
            "special_requests": rental.special_requests or "",
            "created_date": datetime.now(timezone.utc).isoformat()
        }
        
        # Создаем документ
        document_create = DocumentCreate(
            document_type=DocumentType.CONTRACT,
            title=f"Договор аренды #{rental.property.number}",
            content=contract_data,
            rental_id=str(rental.id),
            client_id=str(rental.client_id),
            template_used="rental_contract_v1"
        )
        
        document = DocumentService.create_document(
            db=db,
            document_data=document_create,
            created_by=created_by,
            organization_id=rental.organization_id
        )
        
        return document
    
    @staticmethod
    def generate_work_act(
        db: Session,
        rental: Rental,
        created_by: uuid.UUID
    ) -> Document:
        """Сгенерировать акт выполненных работ"""
        
        # Находим связанные задачи
        from models.extended_models import Task, TaskStatus
        tasks = db.query(Task).filter(
            and_(
                Task.property_id == rental.property_id,
                Task.status == TaskStatus.COMPLETED,
                Task.created_at >= rental.start_date,
                Task.created_at <= rental.end_date
            )
        ).all()
        
        # Подготавливаем данные для акта
        work_items = []
        total_work_cost = 0
        
        for task in tasks:
            work_items.append({
                "description": task.title,
                "type": task.task_type.value,
                "duration": task.actual_duration or task.estimated_duration,
                "cost": task.payment_amount or 0,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "quality_rating": task.quality_rating
            })
            total_work_cost += task.payment_amount or 0
        
        act_data = {
            "rental_id": str(rental.id),
            "property_name": rental.property.name,
            "client_name": f"{rental.client.first_name} {rental.client.last_name}",
            "period_start": rental.start_date.isoformat(),
            "period_end": rental.end_date.isoformat(),
            "work_items": work_items,
            "total_work_cost": total_work_cost,
            "created_date": datetime.now(timezone.utc).isoformat()
        }
        
        # Создаем документ
        document_create = DocumentCreate(
            document_type=DocumentType.ACT_OF_WORK,
            title=f"Акт выполненных работ #{rental.property.number}",
            content=act_data,
            rental_id=str(rental.id),
            client_id=str(rental.client_id),
            template_used="work_act_v1"
        )
        
        document = DocumentService.create_document(
            db=db,
            document_data=document_create,
            created_by=created_by,
            organization_id=rental.organization_id
        )
        
        return document
    
    @staticmethod
    def generate_invoice(
        db: Session,
        rental: Rental,
        created_by: uuid.UUID,
        invoice_items: List[Dict[str, Any]] = None
    ) -> Document:
        """Сгенерировать счет-фактуру"""
        
        if not invoice_items:
            # Создаем базовые позиции счета
            invoice_items = [
                {
                    "description": f"Аренда помещения {rental.property.name}",
                    "quantity": 1,
                    "unit_price": rental.total_amount,
                    "total_price": rental.total_amount,
                    "vat_rate": 12  # НДС в Казахстане
                }
            ]
        
        # Рассчитываем суммы
        subtotal = sum(item["total_price"] for item in invoice_items)
        vat_amount = sum(item["total_price"] * item.get("vat_rate", 12) / 100 for item in invoice_items)
        total_amount = subtotal + vat_amount
        
        invoice_data = {
            "rental_id": str(rental.id),
            "client_name": f"{rental.client.first_name} {rental.client.last_name}",
            "client_address": getattr(rental.client, 'address', ''),
            "invoice_items": invoice_items,
            "subtotal": subtotal,
            "vat_amount": vat_amount,
            "total_amount": total_amount,
            "due_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
            "created_date": datetime.now(timezone.utc).isoformat()
        }
        
        # Создаем документ
        document_create = DocumentCreate(
            document_type=DocumentType.INVOICE,
            title=f"Счет-фактура #{rental.property.number}",
            content=invoice_data,
            rental_id=str(rental.id),
            client_id=str(rental.client_id),
            template_used="invoice_v1"
        )
        
        document = DocumentService.create_document(
            db=db,
            document_data=document_create,
            created_by=created_by,
            organization_id=rental.organization_id
        )
        
        return document
    
    @staticmethod
    def generate_pdf(db: Session, document: Document) -> bytes:
        """Генерировать PDF документа"""
        
        buffer = io.BytesIO()
        
        if document.document_type == DocumentType.CONTRACT:
            pdf_content = DocumentService._generate_contract_pdf(db, document, buffer)
        elif document.document_type == DocumentType.ACT_OF_WORK:
            pdf_content = DocumentService._generate_act_pdf(db, document, buffer)
        elif document.document_type == DocumentType.INVOICE:
            pdf_content = DocumentService._generate_invoice_pdf(db, document, buffer)
        elif document.document_type == DocumentType.RECEIPT:
            pdf_content = DocumentService._generate_receipt_pdf(db, document, buffer)
        else:
            pdf_content = DocumentService._generate_generic_pdf(db, document, buffer)
        
        # Сохраняем путь к файлу в документе если нужно
        # document.file_path = f"/documents/{document.id}.pdf"
        # db.commit()
        
        return pdf_content
    
    @staticmethod
    def _generate_contract_pdf(db: Session, document: Document, buffer: io.BytesIO) -> bytes:
        """Генерировать PDF договора аренды"""
        
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        story = []
        
        # Заголовок
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=20,
            alignment=1,  # Центрирование
            textColor=darkblue
        )
        
        story.append(Paragraph("ДОГОВОР АРЕНДЫ ПОМЕЩЕНИЯ", title_style))
        story.append(Paragraph(f"№ {document.document_number}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Получаем организацию
        organization = db.query(Organization).filter(
            Organization.id == document.organization_id
        ).first()
        
        content = document.content or {}
        
        # Информация о сторонах
        parties_text = f"""
        <b>АРЕНДОДАТЕЛЬ:</b><br/>
        {organization.name if organization else 'Организация'}<br/>
        Адрес: {organization.address if organization and organization.address else 'Не указан'}<br/>
        Телефон: {organization.phone if organization and organization.phone else 'Не указан'}<br/>
        Email: {organization.email if organization and organization.email else 'Не указан'}<br/>
        <br/>
        <b>АРЕНДАТОР:</b><br/>
        {content.get('client_name', 'Не указано')}<br/>
        Телефон: {content.get('client_phone', 'Не указан')}<br/>
        Email: {content.get('client_email', 'Не указан')}<br/>
        """
        
        story.append(Paragraph(parties_text, styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Предмет договора
        subject_text = f"""
        <b>1. ПРЕДМЕТ ДОГОВОРА</b><br/>
        1.1. Арендодатель обязуется предоставить Арендатору во временное пользование помещение:<br/>
        Наименование: {content.get('property_name', 'Не указано')}<br/>
        Адрес: {content.get('property_address', 'Не указан')}<br/>
        <br/>
        1.2. Срок аренды: с {content.get('start_date', '').split('T')[0]} по {content.get('end_date', '').split('T')[0]}<br/>
        1.3. Тип аренды: {content.get('rental_type', 'Не указан')}<br/>
        1.4. Количество гостей: {content.get('guest_count', 1)}<br/>
        """
        
        story.append(Paragraph(subject_text, styles['Normal']))
        story.append(Spacer(1, 15))
        
        # Стоимость
        cost_text = f"""
        <b>2. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ</b><br/>
        2.1. Стоимость аренды составляет: {content.get('total_amount', 0):,.2f} тенге<br/>
        2.2. Размер залога: {content.get('deposit', 0):,.2f} тенге<br/>
        2.3. Оплата производится до заселения<br/>
        """
        
        story.append(Paragraph(cost_text, styles['Normal']))
        story.append(Spacer(1, 15))
        
        # Обязанности сторон
        obligations_text = """
        <b>3. ОБЯЗАННОСТИ СТОРОН</b><br/>
        3.1. Арендодатель обязуется:<br/>
        - Предоставить помещение в надлежащем состоянии<br/>
        - Обеспечить исправность коммунальных услуг<br/>
        <br/>
        3.2. Арендатор обязуется:<br/>
        - Использовать помещение по назначению<br/>
        - Поддерживать чистоту и порядок<br/>
        - Возместить ущерб при его причинении<br/>
        """
        
        story.append(Paragraph(obligations_text, styles['Normal']))
        story.append(Spacer(1, 15))
        
        # Дополнительные условия
        if content.get('special_requests'):
            additional_text = f"""
            <b>4. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ</b><br/>
            {content.get('special_requests')}
            """
            story.append(Paragraph(additional_text, styles['Normal']))
            story.append(Spacer(1, 15))
        
        # Подписи
        signature_text = """
        <b>ПОДПИСИ СТОРОН:</b><br/><br/>
        Арендодатель: ___________________ <br/><br/>
        Арендатор: ___________________ <br/><br/>
        """
        
        story.append(Paragraph(signature_text, styles['Normal']))
        
        # Дата создания
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"Дата составления: {datetime.now().strftime('%d.%m.%Y')}", styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def _generate_act_pdf(db: Session, document: Document, buffer: io.BytesIO) -> bytes:
        """Генерировать PDF акта выполненных работ"""
        
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        story = []
        
        # Заголовок
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=20,
            alignment=1,
            textColor=darkblue
        )
        
        story.append(Paragraph("АКТ ВЫПОЛНЕННЫХ РАБОТ", title_style))
        story.append(Paragraph(f"№ {document.document_number}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        content = document.content or {}
        
        # Основная информация
        info_text = f"""
        <b>Объект:</b> {content.get('property_name', 'Не указан')}<br/>
        <b>Клиент:</b> {content.get('client_name', 'Не указан')}<br/>
        <b>Период:</b> с {content.get('period_start', '').split('T')[0]} по {content.get('period_end', '').split('T')[0]}<br/>
        """
        
        story.append(Paragraph(info_text, styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Таблица работ
        work_items = content.get('work_items', [])
        if work_items:
            table_data = [['№', 'Описание работы', 'Тип', 'Время (мин)', 'Стоимость', 'Качество']]
            
            for i, item in enumerate(work_items, 1):
                quality = item.get('quality_rating')
                quality_str = f"{quality}/5" if quality else "Не оценено"
                
                table_data.append([
                    str(i),
                    item.get('description', ''),
                    item.get('type', ''),
                    str(item.get('duration', 0)),
                    f"{item.get('cost', 0):,.2f} ₸",
                    quality_str
                ])
            
            # Итоговая строка
            table_data.append([
                '',
                '<b>ИТОГО:</b>',
                '',
                '',
                f"<b>{content.get('total_work_cost', 0):,.2f} ₸</b>",
                ''
            ])
            
            table = Table(table_data, colWidths=[1*cm, 6*cm, 2*cm, 2*cm, 2.5*cm, 2*cm])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
                ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            story.append(table)
        else:
            story.append(Paragraph("Работы не выполнялись", styles['Normal']))
        
        story.append(Spacer(1, 30))
        
        # Подписи
        signature_text = """
        <b>Подписи:</b><br/><br/>
        Исполнитель: ___________________ <br/><br/>
        Заказчик: ___________________ <br/><br/>
        """
        
        story.append(Paragraph(signature_text, styles['Normal']))
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"Дата составления: {datetime.now().strftime('%d.%m.%Y')}", styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def _generate_invoice_pdf(db: Session, document: Document, buffer: io.BytesIO) -> bytes:
        """Генерировать PDF счета-фактуры"""
        
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        story = []
        
        # Заголовок
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=20,
            alignment=1,
            textColor=darkblue
        )
        
        story.append(Paragraph("СЧЕТ-ФАКТУРА", title_style))
        story.append(Paragraph(f"№ {document.document_number}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        content = document.content or {}
        
        # Информация о плательщике
        client_info = f"""
        <b>Плательщик:</b><br/>
        {content.get('client_name', 'Не указан')}<br/>
        {content.get('client_address', 'Адрес не указан')}<br/>
        """
        
        story.append(Paragraph(client_info, styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Таблица позиций
        invoice_items = content.get('invoice_items', [])
        if invoice_items:
            table_data = [['№', 'Наименование', 'Кол-во', 'Цена', 'Сумма', 'НДС %', 'НДС сумма']]
            
            for i, item in enumerate(invoice_items, 1):
                vat_rate = item.get('vat_rate', 12)
                vat_amount = item.get('total_price', 0) * vat_rate / 100
                
                table_data.append([
                    str(i),
                    item.get('description', ''),
                    str(item.get('quantity', 1)),
                    f"{item.get('unit_price', 0):,.2f}",
                    f"{item.get('total_price', 0):,.2f}",
                    f"{vat_rate}%",
                    f"{vat_amount:,.2f}"
                ])
            
            table = Table(table_data, colWidths=[1*cm, 5*cm, 1.5*cm, 2*cm, 2*cm, 1.5*cm, 2*cm])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            story.append(table)
        
        story.append(Spacer(1, 20))
        
        # Итоги
        totals_text = f"""
        <b>Итого к оплате:</b><br/>
        Сумма без НДС: {content.get('subtotal', 0):,.2f} тенге<br/>
        НДС: {content.get('vat_amount', 0):,.2f} тенге<br/>
        <b>Всего к оплате: {content.get('total_amount', 0):,.2f} тенге</b><br/>
        <br/>
        Срок оплаты: {content.get('due_date', '').split('T')[0] if content.get('due_date') else 'Не указан'}
        """
        
        story.append(Paragraph(totals_text, styles['Normal']))
        story.append(Spacer(1, 30))
        
        # Подпись
        story.append(Paragraph("Выставил: ___________________", styles['Normal']))
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"Дата: {datetime.now().strftime('%d.%m.%Y')}", styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def _generate_receipt_pdf(db: Session, document: Document, buffer: io.BytesIO) -> bytes:
        """Генерировать PDF квитанции"""
        
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Простая квитанция
        story.append(Paragraph("КВИТАНЦИЯ ОБ ОПЛАТЕ", styles['Title']))
        story.append(Paragraph(f"№ {document.document_number}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        content = document.content or {}
        receipt_text = f"""
        Получено от: {content.get('client_name', 'Не указан')}<br/>
        За услуги: {content.get('service_description', 'Аренда помещения')}<br/>
        Сумма: {content.get('amount', 0):,.2f} тенге<br/>
        Дата: {content.get('payment_date', datetime.now().strftime('%d.%m.%Y'))}
        """
        
        story.append(Paragraph(receipt_text, styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def _generate_generic_pdf(db: Session, document: Document, buffer: io.BytesIO) -> bytes:
        """Генерировать общий PDF документ"""
        
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        story.append(Paragraph(document.title, styles['Title']))
        story.append(Paragraph(f"№ {document.document_number}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Содержимое документа
        if document.content:
            content_text = json.dumps(document.content, ensure_ascii=False, indent=2)
            story.append(Paragraph(f"<pre>{content_text}</pre>", styles['Code']))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def send_esf_to_system(db: Session, document: Document) -> Dict[str, Any]:
        """Отправить ЭСФ в информационную систему"""
        
        if document.document_type != DocumentType.ESF:
            raise ValueError("Document is not an ESF")
        
        # Симуляция отправки ЭСФ
        # В реальной системе здесь будет интеграция с API ИС ЭСФ
        
        esf_data = {
            "document_id": str(document.id),
            "document_number": document.document_number,
            "content": document.content,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Симулируем успешную отправку
        response = {
            "status": "sent",
            "esf_id": f"ESF_{document.document_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "response_code": "200",
            "message": "ЭСФ успешно отправлена в ИС"
        }
        
        # Обновляем документ
        document.esf_status = "sent"
        document.esf_sent_at = datetime.now(timezone.utc)
        document.esf_response = response
        document.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        
        return response
    
    @staticmethod
    def _generate_document_number(
        db: Session, 
        organization_id: uuid.UUID, 
        document_type: DocumentType
    ) -> str:
        """Генерировать номер документа"""
        
        # Префиксы для разных типов документов
        prefixes = {
            DocumentType.CONTRACT: "DOG",
            DocumentType.INVOICE: "SF",
            DocumentType.ACT_OF_WORK: "AKT",
            DocumentType.RECEIPT: "KVT",
            DocumentType.ESF: "ESF"
        }
        
        prefix = prefixes.get(document_type, "DOC")
        
        # Получаем текущую дату
        today = datetime.now(timezone.utc)
        date_part = today.strftime("%y%m%d")
        
        # Считаем документы данного типа за сегодня
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        count = db.query(Document).filter(
            and_(
                Document.organization_id == organization_id,
                Document.document_type == document_type,
                Document.created_at >= today_start,
                Document.created_at < today_end
            )
        ).count()
        
        # Формируем номер: PREFIX-YYMMDD-NNNN
        return f"{prefix}-{date_part}-{count + 1:04d}"
    
    @staticmethod
    def create_esf_document(
        db: Session,
        rental: Rental,
        created_by: uuid.UUID,
        esf_data: Dict[str, Any]
    ) -> Document:
        """Создать электронную счет-фактуру (ЭСФ)"""
        
        # Подготавливаем данные для ЭСФ согласно требованиям РК
        esf_content = {
            "seller": {
                "name": esf_data.get("seller_name", ""),
                "bin": esf_data.get("seller_bin", ""),
                "address": esf_data.get("seller_address", ""),
                "bank_account": esf_data.get("seller_account", ""),
                "bank_name": esf_data.get("seller_bank", "")
            },
            "buyer": {
                "name": f"{rental.client.first_name} {rental.client.last_name}",
                "bin_iin": esf_data.get("buyer_bin_iin", ""),
                "address": getattr(rental.client, 'address', ''),
            },
            "invoice_info": {
                "invoice_date": datetime.now(timezone.utc).isoformat(),
                "currency": "KZT",
                "exchange_rate": 1.0
            },
            "goods_services": [
                {
                    "name": f"Аренда помещения {rental.property.name}",
                    "unit": "услуга",
                    "quantity": 1,
                    "price": rental.total_amount,
                    "amount": rental.total_amount,
                    "vat_rate": 12,
                    "vat_amount": rental.total_amount * 0.12,
                    "total_with_vat": rental.total_amount * 1.12
                }
            ],
            "totals": {
                "total_amount": rental.total_amount,
                "total_vat": rental.total_amount * 0.12,
                "total_with_vat": rental.total_amount * 1.12
            },
            "additional_info": esf_data.get("additional_info", "")
        }
        
        # Создаем документ ЭСФ
        document_create = DocumentCreate(
            document_type=DocumentType.ESF,
            title=f"ЭСФ #{rental.property.number}",
            content=esf_content,
            rental_id=str(rental.id),
            client_id=str(rental.client_id),
            template_used="esf_v1"
        )
        
        document = DocumentService.create_document(
            db=db,
            document_data=document_create,
            created_by=created_by,
            organization_id=rental.organization_id
        )
        
        return document
    
    @staticmethod
    def get_document_templates() -> Dict[str, Dict[str, Any]]:
        """Получить доступные шаблоны документов"""
        
        return {
            "rental_contract_v1": {
                "name": "Договор аренды (стандартный)",
                "description": "Стандартный шаблон договора аренды помещения",
                "document_type": "contract",
                "fields": [
                    "property_name", "property_address", "client_name", 
                    "start_date", "end_date", "total_amount", "deposit"
                ]
            },
            "work_act_v1": {
                "name": "Акт выполненных работ",
                "description": "Акт выполненных работ по обслуживанию помещения",
                "document_type": "act_of_work",
                "fields": [
                    "property_name", "client_name", "work_items", "total_work_cost"
                ]
            },
            "invoice_v1": {
                "name": "Счет-фактура",
                "description": "Стандартный счет-фактура",
                "document_type": "invoice",
                "fields": [
                    "client_name", "invoice_items", "subtotal", "vat_amount", "total_amount"
                ]
            },
            "esf_v1": {
                "name": "Электронная счет-фактура",
                "description": "ЭСФ для подачи в ИС ЭСФ РК",
                "document_type": "esf",
                "fields": [
                    "seller", "buyer", "goods_services", "totals"
                ]
            }
        }
    
    @staticmethod
    def validate_document_content(
        document_type: DocumentType, 
        content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Валидация содержимого документа"""
        
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        if document_type == DocumentType.CONTRACT:
            required_fields = [
                "property_name", "client_name", "start_date", 
                "end_date", "total_amount"
            ]
            
            for field in required_fields:
                if not content.get(field):
                    validation_result["errors"].append(f"Обязательное поле '{field}' не заполнено")
            
            # Проверяем даты
            try:
                start_date = datetime.fromisoformat(content.get("start_date", ""))
                end_date = datetime.fromisoformat(content.get("end_date", ""))
                
                if end_date <= start_date:
                    validation_result["errors"].append("Дата окончания должна быть позже даты начала")
                    
            except (ValueError, TypeError):
                validation_result["errors"].append("Некорректный формат дат")
            
            # Проверяем сумму
            try:
                amount = float(content.get("total_amount", 0))
                if amount <= 0:
                    validation_result["errors"].append("Сумма должна быть больше нуля")
            except (ValueError, TypeError):
                validation_result["errors"].append("Некорректная сумма")
        
        elif document_type == DocumentType.ESF:
            # Валидация ЭСФ
            if not content.get("seller", {}).get("bin"):
                validation_result["errors"].append("БИН продавца обязателен для ЭСФ")
            
            if not content.get("buyer", {}).get("bin_iin"):
                validation_result["warnings"].append("БИН/ИИН покупателя не указан")
            
            goods_services = content.get("goods_services", [])
            if not goods_services:
                validation_result["errors"].append("Необходимо указать товары/услуги")
            
            for item in goods_services:
                if not item.get("name"):
                    validation_result["errors"].append("Наименование товара/услуги обязательно")
                if not item.get("quantity") or item.get("quantity") <= 0:
                    validation_result["errors"].append("Количество должно быть больше нуля")
        
        validation_result["valid"] = len(validation_result["errors"]) == 0
        
        return validation_result
    
    @staticmethod
    def get_document_history(
        db: Session,
        document_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """Получить историю изменений документа"""
        
        # В реальной системе здесь будет запрос к таблице аудита
        # Пока возвращаем заглушку
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return []
        
        history = [
            {
                "action": "created",
                "timestamp": document.created_at,
                "user_id": str(document.created_by) if document.created_by else None,
                "details": {
                    "document_type": document.document_type.value,
                    "title": document.title
                }
            }
        ]
        
        if document.is_signed:
            history.append({
                "action": "signed",
                "timestamp": document.signed_at,
                "user_id": document.signature_data.get("signed_by") if document.signature_data else None,
                "details": {
                    "signature_type": document.signature_data.get("signature_type") if document.signature_data else None
                }
            })
        
        if document.esf_sent_at:
            history.append({
                "action": "esf_sent",
                "timestamp": document.esf_sent_at,
                "details": {
                    "esf_status": document.esf_status,
                    "esf_id": document.esf_response.get("esf_id") if document.esf_response else None
                }
            })
        
        return sorted(history, key=lambda x: x["timestamp"])
    
    @staticmethod
    def bulk_generate_documents(
        db: Session,
        rental_ids: List[uuid.UUID],
        document_type: DocumentType,
        created_by: uuid.UUID,
        organization_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Массовая генерация документов"""
        
        results = {
            "success": [],
            "errors": [],
            "total": len(rental_ids)
        }
        
        for rental_id in rental_ids:
            try:
                rental = db.query(Rental).filter(
                    and_(
                        Rental.id == rental_id,
                        Rental.organization_id == organization_id
                    )
                ).first()
                
                if not rental:
                    results["errors"].append({
                        "rental_id": str(rental_id),
                        "error": "Аренда не найдена"
                    })
                    continue
                
                # Генерируем документ в зависимости от типа
                if document_type == DocumentType.CONTRACT:
                    document = DocumentService.generate_rental_contract(
                        db, rental, created_by
                    )
                elif document_type == DocumentType.ACT_OF_WORK:
                    document = DocumentService.generate_work_act(
                        db, rental, created_by
                    )
                elif document_type == DocumentType.INVOICE:
                    document = DocumentService.generate_invoice(
                        db, rental, created_by
                    )
                else:
                    results["errors"].append({
                        "rental_id": str(rental_id),
                        "error": f"Неподдерживаемый тип документа: {document_type.value}"
                    })
                    continue
                
                results["success"].append({
                    "rental_id": str(rental_id),
                    "document_id": str(document.id),
                    "document_number": document.document_number
                })
                
            except Exception as e:
                results["errors"].append({
                    "rental_id": str(rental_id),
                    "error": str(e)
                })
        
        return results
    
    @staticmethod
    def archive_old_documents(
        db: Session,
        organization_id: uuid.UUID,
        days_old: int = 365
    ) -> Dict[str, Any]:
        """Архивирование старых документов"""
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        # Найти старые документы
        old_documents = db.query(Document).filter(
            and_(
                Document.organization_id == organization_id,
                Document.created_at < cutoff_date,
                Document.is_signed == True  # Архивируем только подписанные
            )
        ).all()
        
        archived_count = 0
        errors = []
        
        for document in old_documents:
            try:
                # В реальной системе здесь будет перемещение файлов в архив
                # Помечаем документ как архивный (можно добавить поле is_archived)
                archived_count += 1
                
            except Exception as e:
                errors.append({
                    "document_id": str(document.id),
                    "error": str(e)
                })
        
        return {
            "archived_count": archived_count,
            "errors": errors,
            "cutoff_date": cutoff_date.isoformat()
        }
    
    @staticmethod
    def search_documents(
        db: Session,
        organization_id: uuid.UUID,
        search_params: Dict[str, Any]
    ) -> List[Document]:
        """Поиск документов по параметрам"""
        
        query = db.query(Document).filter(Document.organization_id == organization_id)
        
        # Фильтр по типу документа
        if search_params.get("document_type"):
            query = query.filter(Document.document_type == search_params["document_type"])
        
        # Фильтр по номеру документа
        if search_params.get("document_number"):
            query = query.filter(Document.document_number.ilike(f"%{search_params['document_number']}%"))
        
        # Фильтр по заголовку
        if search_params.get("title"):
            query = query.filter(Document.title.ilike(f"%{search_params['title']}%"))
        
        # Фильтр по аренде
        if search_params.get("rental_id"):
            query = query.filter(Document.rental_id == uuid.UUID(search_params["rental_id"]))
        
        # Фильтр по клиенту
        if search_params.get("client_id"):
            query = query.filter(Document.client_id == uuid.UUID(search_params["client_id"]))
        
        # Фильтр по статусу подписи
        if search_params.get("is_signed") is not None:
            query = query.filter(Document.is_signed == search_params["is_signed"])
        
        # Фильтр по датам
        if search_params.get("date_from"):
            date_from = datetime.fromisoformat(search_params["date_from"])
            query = query.filter(Document.created_at >= date_from)
        
        if search_params.get("date_to"):
            date_to = datetime.fromisoformat(search_params["date_to"])
            query = query.filter(Document.created_at <= date_to)
        
        # Сортировка
        sort_by = search_params.get("sort_by", "created_at")
        sort_order = search_params.get("sort_order", "desc")
        
        if sort_order == "desc":
            query = query.order_by(desc(getattr(Document, sort_by)))
        else:
            query = query.order_by(getattr(Document, sort_by))
        
        # Пагинация
        limit = search_params.get("limit", 100)
        offset = search_params.get("offset", 0)
        
        return query.offset(offset).limit(limit).all()