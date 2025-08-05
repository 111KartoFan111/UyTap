// frontend/src/utils/exportDebug.js
export const debugExport = {
  // Логирование информации о blob
  logBlobInfo: (blob, filename) => {
    console.log('Export Debug Info:', {
      filename,
      blobSize: blob.size,
      blobType: blob.type,
      isEmpty: blob.size === 0,
      timestamp: new Date().toISOString()
    });
  },

  // Проверка поддержки браузером
  checkBrowserSupport: () => {
    const support = {
      downloadAttribute: 'download' in document.createElement('a'),
      createObjectURL: !!window.URL?.createObjectURL,
      revokeObjectURL: !!window.URL?.revokeObjectURL,
      blob: !!window.Blob
    };
    
    console.log('Browser Support:', support);
    return support;
  },

  // Альтернативный метод скачивания для старых браузеров
  fallbackDownload: (blob, filename) => {
    try {
      // Для IE
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, filename);
        return true;
      }
      
      // Для других браузеров
      const url = window.URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        document.body.removeChild(iframe);
        window.URL.revokeObjectURL(url);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Fallback download failed:', error);
      return false;
    }
  },

  // Тестирование экспорта с mock данными
  testExport: () => {
    const testData = 'Test export data\nЭто тестовые данные для экспорта\n测试数据';
    const blob = new Blob([testData], { type: 'text/plain' });
    
    debugExport.logBlobInfo(blob, 'test.txt');
    debugExport.downloadBlob(blob, 'test_export.txt');
  },

  // Безопасное скачивание blob
  downloadBlob: (blob, filename) => {
    try {
      if (!blob || blob.size === 0) {
        throw new Error('Blob is empty or invalid');
      }

      debugExport.logBlobInfo(blob, filename);

      // Проверяем поддержку браузера
      const support = debugExport.checkBrowserSupport();
      
      if (!support.downloadAttribute || !support.createObjectURL) {
        console.warn('Browser has limited download support, trying fallback');
        return debugExport.fallbackDownload(blob, filename);
      }

      // Стандартный метод
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // Добавляем в DOM перед кликом
      document.body.appendChild(a);
      a.click();
      
      // Очищаем через небольшую задержку
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  },

  // Проверка MIME типов
  validateMimeType: (blob, expectedTypes = []) => {
    const blobType = blob.type.toLowerCase();
    console.log('Blob MIME type:', blobType);
    
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/pdf',
      'application/octet-stream', // Fallback
      'text/plain'
    ];
    
    const allValidTypes = [...validTypes, ...expectedTypes];
    const isValid = allValidTypes.some(type => blobType.includes(type.toLowerCase()));
    
    if (!isValid) {
      console.warn('Unexpected MIME type:', blobType);
    }
    
    return isValid;
  }
};

// Добавляем в глобальную область для отладки в консоли
if (typeof window !== 'undefined') {
  window.debugExport = debugExport;
}