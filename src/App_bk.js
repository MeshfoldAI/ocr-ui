import React, { useState, useEffect } from 'react';
import { Upload, FileText, List, Eye, CheckCircle, Clock, XCircle, AlertCircle, Download, Trash2 } from 'lucide-react';

const API_BASE_URL = '/api/v1';

// Helper function to convert array date to readable format
const formatDateTime = (dateArray) => {
  if (!dateArray) return 'N/A';
  
  // Check if it's already a string
  if (typeof dateArray === 'string') {
    return new Date(dateArray).toLocaleString();
  }
  
  // Convert array [year, month, day, hour, minute, second, nano] to Date
  if (Array.isArray(dateArray) && dateArray.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = dateArray;
    const date = new Date(year, month - 1, day, hour, minute, second);
    return date.toLocaleString();
  }
  
  return 'Invalid Date';
};

// Helper function to convert base64 to Blob
const base64ToBlob = (base64, mimeType) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: mimeType });
};

const OcrApp = () => {
  const [activeView, setActiveView] = useState('upload');
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [uploadMode, setUploadMode] = useState('process'); // 'upload' or 'process'
  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Only auto-refresh when on documents page and auto-refresh is enabled
    if (autoRefresh && activeView === 'documents') {
      const interval = setInterval(fetchDocuments, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeView]);

  // Upload document
  const handleFileUpload = async (file, processImmediately = false) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = processImmediately ? '/documents/upload-and-process' : '/documents/upload';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`Document uploaded successfully! ${processImmediately ? 'Processing started.' : ''}`);
        fetchDocuments();
      } else {
        alert('Upload failed: ' + data.message);
      }
    } catch (error) {
      alert('Error uploading document: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Process document
  const processDocument = async (documentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}/process`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('Processing started! Check status in a few moments.');
        fetchDocuments();
      }
    } catch (error) {
      alert('Error processing document: ' + error.message);
    }
  };

  // View document details
  const viewDocumentDetails = async (document) => {
    setLoading(true);
    setSelectedDocument(document);
    setActiveView('preview');

    try {
      // Fetch preview
      const previewResponse = await fetch(`${API_BASE_URL}/documents/${document.id}/preview`);
      const previewData = await previewResponse.json();
      if (previewData.success) {
        setDocumentPreview(previewData.data);
      }

      // Fetch OCR results if available
      if (document.status === 'COMPLETED') {
        const ocrResponse = await fetch(`${API_BASE_URL}/documents/${document.id}/ocr`);
        const ocrData = await ocrResponse.json();
        if (ocrData.success) {
          setOcrResult(ocrData.data);
        }
      }
    } catch (error) {
      console.error('Error fetching document details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete document
  const deleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        alert('Document deleted successfully!');
        fetchDocuments();
        if (selectedDocument?.id === documentId) {
          setSelectedDocument(null);
          setOcrResult(null);
          setDocumentPreview(null);
          setActiveView('documents');
        }
      }
    } catch (error) {
      alert('Error deleting document: ' + error.message);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      UPLOADED: { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'Uploaded' },
      PROCESSING: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Processing' },
      COMPLETED: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Completed' },
      FAILED: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Failed' },
    };

    const config = statusConfig[status] || statusConfig.UPLOADED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  // Upload View
  const UploadView = () => (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Upload Document</h2>
        
        {/* Upload Mode Selection */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Processing Option
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="uploadMode"
                value="upload"
                checked={uploadMode === 'upload'}
                onChange={(e) => setUploadMode(e.target.value)}
                className="w-4 h-4 text-blue-600 cursor-pointer"
              />
              <span className="ml-2 text-gray-700">
                <span className="font-medium">Upload Only</span>
                <span className="block text-sm text-gray-500">Save document for later processing</span>
              </span>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="uploadMode"
                value="process"
                checked={uploadMode === 'process'}
                onChange={(e) => setUploadMode(e.target.value)}
                className="w-4 h-4 text-blue-600 cursor-pointer"
              />
              <span className="ml-2 text-gray-700">
                <span className="font-medium">Upload & Process</span>
                <span className="block text-sm text-gray-500">Start OCR immediately after upload</span>
              </span>
            </label>
          </div>
        </div>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 mb-4">Drag and drop your document here, or click to browse</p>
          
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*,.pdf"
            onChange={(e) => {
              if (e.target.files[0]) {
                const file = e.target.files[0];
                const shouldProcess = uploadMode === 'process';
                handleFileUpload(file, shouldProcess);
                // Reset the input
                e.target.value = '';
              }
            }}
          />
          
          <label
            htmlFor="file-upload"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
          >
            {uploading ? 'Uploading...' : 'Select File'}
          </label>
          
          <p className="text-sm text-gray-500 mt-4">Supported formats: Images (PNG, JPG, JPEG) and PDF</p>
          
          {uploadMode === 'process' && (
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600">
              <CheckCircle size={16} />
              <span>Will process immediately after upload</span>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Quick Tips</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Use high-resolution images (300 DPI recommended)</li>
                <li>• Ensure good contrast and lighting</li>
                <li>• Supported languages: English, Spanish, French, German, and more</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Documents List View
  const DocumentsView = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Documents</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {autoRefresh ? (
              <span className="flex items-center gap-2">
                <Clock size={16} className="animate-pulse" />
                Auto-refresh ON
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock size={16} />
                Auto-refresh OFF
              </span>
            )}
          </button>
          <button
            onClick={fetchDocuments}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto mb-4 text-gray-300" size={64} />
          <p className="text-gray-500">No documents uploaded yet</p>
          <button
            onClick={() => setActiveView('upload')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => viewDocumentDetails(doc)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="text-blue-600" size={20} />
                    <h3 className="font-semibold text-lg">{doc.originalFileName}</h3>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>Size: {(doc.fileSize / 1024).toFixed(2)} KB</span>
                    <span>•</span>
                    <span>Uploaded: {formatDateTime(doc.uploadDate)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.status} />
                    {doc.ocrResults && doc.ocrResults.length > 0 && (
                      <span className="text-xs text-gray-500">
                        Confidence: {doc.ocrResults[0].confidenceScore?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {doc.status === 'UPLOADED' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        processDocument(doc.id);
                      }}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Process
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocument(doc.id);
                    }}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Preview View
  const PreviewView = () => (
    <div className="p-6">
      <button
        onClick={() => {
          setActiveView('documents');
          setSelectedDocument(null);
          setOcrResult(null);
          setDocumentPreview(null);
        }}
        className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
      >
        ← Back to Documents
      </button>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Preview */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Document Preview</h3>
            
            {selectedDocument && (
              <div className="mb-4 space-y-2 text-sm">
                <p><strong>File:</strong> {selectedDocument.originalFileName}</p>
                <p><strong>Status:</strong> <StatusBadge status={selectedDocument.status} /></p>
                <p><strong>Size:</strong> {(selectedDocument.fileSize / 1024).toFixed(2)} KB</p>
                <p><strong>Uploaded:</strong> {formatDateTime(selectedDocument.uploadDate)}</p>
                {selectedDocument.updatedAt && (
                  <p><strong>Updated:</strong> {formatDateTime(selectedDocument.updatedAt)}</p>
                )}
              </div>
            )}

            {documentPreview && (
              <div className="border rounded-lg overflow-hidden bg-gray-50">
                {documentPreview.contentType?.startsWith('image/') ? (
                  <img
                    src={`data:${documentPreview.contentType};base64,${documentPreview.base64Content}`}
                    alt="Document preview"
                    className="w-full h-auto"
                  />
                ) : documentPreview.contentType === 'application/pdf' ? (
                  <div className="bg-white">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        PDF Document Preview
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const blob = base64ToBlob(documentPreview.base64Content, 'application/pdf');
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          <Eye size={14} />
                          Open in New Tab
                        </button>
                        <a
                          href={`data:${documentPreview.contentType};base64,${documentPreview.base64Content}`}
                          download={selectedDocument?.originalFileName}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    </div>
                    
                    <div className="bg-gray-100 p-2">
                      <object
                        data={`data:application/pdf;base64,${documentPreview.base64Content}`}
                        type="application/pdf"
                        className="w-full h-[700px] border border-gray-300 rounded bg-white"
                        style={{ minHeight: '700px' }}
                      >
                        <div className="text-center py-12 bg-white border border-gray-300 rounded">
                          <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600 mb-2">PDF preview not available in this browser</p>
                          <p className="text-sm text-gray-500 mb-4">Use the buttons above to view the document</p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => {
                                const blob = base64ToBlob(documentPreview.base64Content, 'application/pdf');
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Eye size={16} />
                              Open in New Tab
                            </button>
                            <a
                              href={`data:${documentPreview.contentType};base64,${documentPreview.base64Content}`}
                              download={selectedDocument?.originalFileName}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Download size={16} />
                              Download PDF
                            </a>
                          </div>
                        </div>
                      </object>
                    </div>
                    
                    <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">
                      If preview doesn't load, use "Open in New Tab" or "Download" buttons above
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-2" />
                    <p>Preview not available for this file type</p>
                    <p className="text-xs mt-2">OCR results shown on the right →</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OCR Results */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-auto max-h-[800px]">
            <h3 className="text-xl font-bold mb-4">OCR Results</h3>

            {!ocrResult ? (
              <div className="text-center py-12 text-gray-500">
                {selectedDocument?.status === 'PROCESSING' ? (
                  <>
                    <Clock size={48} className="mx-auto mb-2 animate-pulse" />
                    <p>Processing in progress...</p>
                  </>
                ) : selectedDocument?.status === 'UPLOADED' ? (
                  <>
                    <AlertCircle size={48} className="mx-auto mb-2" />
                    <p>Document not processed yet</p>
                    <button
                      onClick={() => processDocument(selectedDocument.id)}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Process Now
                    </button>
                  </>
                ) : (
                  <>
                    <XCircle size={48} className="mx-auto mb-2" />
                    <p>No OCR results available</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Provider:</span>
                      <span className="ml-2 font-medium">{ocrResult.ocrProvider}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence:</span>
                      <span className="ml-2 font-medium">{ocrResult.confidenceScore?.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Pages:</span>
                      <span className="ml-2 font-medium">{ocrResult.pageCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-medium">{ocrResult.processingTimeMs}ms</span>
                    </div>
                  </div>
                </div>

                {/* Extracted Text */}
                <div>
                  <h4 className="font-semibold mb-2">Extracted Text</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{ocrResult.rawText || 'No text extracted'}</pre>
                  </div>
                </div>

                {/* Form Fields */}
                {ocrResult.formFields && ocrResult.formFields.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Form Fields ({ocrResult.formFields.length})</h4>
                    <div className="space-y-2">
                      {ocrResult.formFields.map((field) => (
                        <div key={field.id} className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="font-medium text-green-900">{field.fieldKey}:</span>
                              <span className="ml-2 text-green-800">{field.fieldValue}</span>
                            </div>
                            <span className="text-xs text-green-600">{field.confidence?.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tables */}
                {ocrResult.tables && ocrResult.tables.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Tables ({ocrResult.tables.length})</h4>
                    {ocrResult.tables.map((table, idx) => (
                      <div key={table.id} className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          Table {idx + 1} - {table.rowCount}x{table.columnCount} - Confidence: {table.confidence?.toFixed(1)}%
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-300 text-sm">
                            <tbody>
                              {table.tableData?.map((row, rowIdx) => (
                                <tr key={rowIdx} className={rowIdx === 0 ? 'bg-gray-100 font-semibold' : ''}>
                                  {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="border border-gray-300 px-2 py-1">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">OCR Service</h1>
          <p className="text-sm text-gray-500 mt-1">Document Processing</p>
        </div>

        <nav className="flex-1 p-4">
          <button
            onClick={() => setActiveView('upload')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
              activeView === 'upload'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Upload size={20} />
            <span>Upload Document</span>
          </button>

          <button
            onClick={() => setActiveView('documents')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
              activeView === 'documents'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <List size={20} />
            <span>All Documents</span>
            {documents.length > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                {documents.length}
              </span>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          <p>Powered by Tesseract OCR</p>
          <p className="mt-1">v1.0.0</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeView === 'upload' && <UploadView />}
        {activeView === 'documents' && <DocumentsView />}
        {activeView === 'preview' && <PreviewView />}
      </div>
    </div>
  );
};

export default OcrApp;