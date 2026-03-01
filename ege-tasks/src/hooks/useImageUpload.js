import { useState, useCallback } from 'react';

/**
 * Хук для управления состоянием загрузки/выбора изображений.
 * Консолидирует useState для image source, upload, drawing.
 * CropModal управляет своим состоянием crop самостоятельно.
 *
 * @param {string} defaultSource — начальный режим ('url' | 'upload' | 'drawing')
 * @returns {Object} состояния и методы управления изображениями
 */
export function useImageUpload(defaultSource = 'url') {
  const [imageSource, setImageSource] = useState(defaultSource);
  const [drawingImageDataUrl, setDrawingImageDataUrl] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState('');
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const resetImage = useCallback(() => {
    setImageSource(defaultSource);
    setDrawingImageDataUrl(null);
    setUploadedFile(null);
    setUploadPreviewUrl('');
    setCropModalOpen(false);
  }, [defaultSource]);

  return {
    imageSource, setImageSource,
    drawingImageDataUrl, setDrawingImageDataUrl,
    uploadedFile, setUploadedFile,
    uploadPreviewUrl, setUploadPreviewUrl,
    cropModalOpen, setCropModalOpen,
    resetImage,
  };
}
