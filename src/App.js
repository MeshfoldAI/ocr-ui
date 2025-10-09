import React, { useState, useEffect } from 'react';
import { Upload, FileText, List, Eye, CheckCircle, Clock, XCircle, AlertCircle, Download, Trash2 } from 'lucide-react';
import QaReviewView from "./QaReviewView";


const API_BASE_URL = '/api/v1/documents';

// Helper function to convert array date to readable format
const formatDateTime = (dateArray) => {
  if (!dateArray) return 'N/A';
  
  if (typeof dateArray === 'string') {
    return new Date(dateArray).toLocaleString();
  }
  
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
  const [uploadMode, setUploadMode] = useState('process');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}`);
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
  }, []);

  useEffect(() => {
    if (autoRefresh && activeView === 'documents') {
      const interval = setInterval(fetchDocuments, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeView]);

  const handleFileUpload = async (file, processImmediately = false) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = processImmediately ? '/upload-and-process' : '/upload';
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

  const processDocument = async (documentId, e) => {
    e?.stopPropagation(); // Ensure card click never fires
    try {
      const btn = e?.currentTarget;
      if (btn) btn.disabled = true; // prevent double click
      const response = await fetch(`${API_BASE_URL}/${documentId}/process`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('Processing started! Check status in a few moments.');
        await fetchDocuments(); // refresh after processing
      } else {
        alert('Processing failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error processing document: ' + error.message);
    } finally {
      if (e?.currentTarget) e.currentTarget.disabled = false;
    }
  };
  

  const viewDocumentDetails = async (document) => {
    setLoading(true);
    setSelectedDocument(document);
    setActiveView('preview');

    try {
      const previewResponse = await fetch(`${API_BASE_URL}/${document.id}/preview`);
      const previewData = await previewResponse.json();
      if (previewData.success) {
        setDocumentPreview(previewData.data);
      }

      if (document.status === 'COMPLETED') {
        const ocrResponse = await fetch(`${API_BASE_URL}/${document.id}/ocr`);
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

  const deleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/${documentId}`, {
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

  

  const UploadView = () => (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">Upload Document</h2>
  
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 mb-4">
            Drag and drop your document here, or click to browse
          </p>
  
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*,.pdf"
            onChange={(e) => {
              if (e.target.files[0]) {
                const file = e.target.files[0];
                handleFileUpload(file, true); // Always process immediately
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
  
          <p className="text-sm text-gray-500 mt-4">
            Supported formats: Images (PNG, JPG, JPEG) and PDF
          </p>
  
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600">
            <CheckCircle size={16} />
            <span>Processing will start immediately after upload</span>
          </div>
        </div>
  
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="text-blue-600 flex-shrink-0 mt-0.5"
              size={20}
            />
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
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {doc.status === 'UPLOADED' && (
                    <button
                      onClick={(e) => processDocument(doc.id, e)}
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
          {/* Left Panel - Document Preview */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Document Preview</h3>
  
            {selectedDocument && (
            <div className="flex flex-wrap items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-4 text-sm text-gray-700">
                <div className="flex items-center gap-2 truncate max-w-[60%]">
                <FileText size={16} className="text-blue-600 flex-shrink-0" />
                <span className="font-medium truncate" title={selectedDocument.originalFileName}>
                    {selectedDocument.originalFileName}
                </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-600">
                <StatusBadge status={selectedDocument.status} />
                <span>{(selectedDocument.fileSize / 1024).toFixed(2)} KB</span>
                <span>•</span>
                <span>{formatDateTime(selectedDocument.uploadDate)}</span>
                {selectedDocument.updatedAt && (
                    <>
                    <span>•</span>
                    <span>Updated: {formatDateTime(selectedDocument.updatedAt)}</span>
                    </>
                )}
                </div>
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
                      <iframe
                        src={(() => {
                          const blob = base64ToBlob(documentPreview.base64Content, 'application/pdf');
                          return URL.createObjectURL(blob);
                        })()}
                        className="w-full h-[700px] border border-gray-300 rounded bg-white"
                        title="PDF Preview"
                      />
                    </div>
  
                    <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500">
                      Inline PDF preview — use buttons above for download or new tab
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
  
          {/* Right Panel - OCR Results */}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Provider:</span>
                      <span className="ml-2 font-medium">{ocrResult.ocrProvider}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Pages:</span>
                      <span className="ml-2 font-medium">{ocrResult.pageCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-medium">{ocrResult.processingTimeMs}ms</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Document Type:</span>
                      <span className="ml-2 font-medium">{ocrResult.docType}</span>
                    </div>
                  </div>
                </div>
  
                {ocrResult.structuredJson && (
                <div>
                    <h4 className="font-semibold mb-2">Structured Data</h4>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm">
                    {(() => {
                        try {
                        const structured = JSON.parse(ocrResult.structuredJson);

                        // Recursive function to render nested JSON nicely
                        const renderObject = (obj, level = 0) => {
                            return Object.entries(obj).map(([key, value]) => {
                            const formattedKey = key.replace(/_/g, ' ');
                            const padding = { paddingLeft: `${level * 16}px` };

                            if (value && typeof value === 'object' && !Array.isArray(value)) {
                                return (
                                <div key={key} style={padding} className="mb-2">
                                    <p className="font-medium text-indigo-900 capitalize">
                                    {formattedKey}
                                    </p>
                                    <div className="ml-2 border-l border-indigo-200 pl-3">
                                    {renderObject(value, level + 1)}
                                    </div>
                                </div>
                                );
                            } else {
                                return (
                                <div
                                    key={key}
                                    style={padding}
                                    className="flex justify-between border-b border-indigo-100 py-1"
                                >
                                    <span className="text-indigo-900 capitalize">{formattedKey}</span>
                                    <span className="text-indigo-800 text-right break-all">
                                    {String(value)}
                                    </span>
                                </div>
                                );
                            }
                            });
                        };

                        return renderObject(structured);
                        } catch (e) {
                        return (
                            <p className="text-red-500 text-sm">
                            Invalid structured JSON format
                            </p>
                        );
                        }
                    })()}
                    </div>
                </div>
                )}
                <div>
                  <h4 className="font-semibold mb-2">Extracted Text</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{ocrResult.rawText || 'No text extracted'}</pre>
                  </div>
                </div>
  

                {ocrResult.tables && ocrResult.tables.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Tables ({ocrResult.tables.length})</h4>
                    {ocrResult.tables.map((table, idx) => (
                      <div key={table.id} className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          Table {idx + 1} - {table.rowCount}x{table.columnCount}
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
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
  
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const DocumentTypesView = () => {
    const [documentTypes, setDocumentTypes] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDocType, setNewDocType] = useState({
      code: '',
      name: '',
      description: '',
      example: '',
    });
    const [loading, setLoading] = useState(false);
  
    // For "Add Field" modal
    const [selectedDocType, setSelectedDocType] = useState(null);
    const [showAddFieldModal, setShowAddFieldModal] = useState(false);
    const [newField, setNewField] = useState({
      name: '',
      displayName: '',
      dataType: 'string',
      required: false,
      orderIndex: 0,
    });
  
    const fetchDocumentTypes = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/document-types`);
        const data = await res.json();
  
        if (Array.isArray(data)) setDocumentTypes(data);
        else if (Array.isArray(data.content)) setDocumentTypes(data.content);
        else if (Array.isArray(data.data)) setDocumentTypes(data.data);
        else setDocumentTypes([]);
      } catch (err) {
        console.error('Error fetching document types:', err);
        setDocumentTypes([]);
      }
    };
  
    useEffect(() => {
      fetchDocumentTypes();
    }, []);
  
    const handleAddDocumentType = async (e) => {
      e.preventDefault();
      setLoading(true);
  
      try {
        const res = await fetch(`${API_BASE_URL}/document-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDocType),
        });
  
        if (!res.ok) throw new Error('Failed to add document type');
  
        setNewDocType({ code: '', name: '', description: '', example: '' });
        setShowAddForm(false);
        fetchDocumentTypes();
        alert('Document type added successfully!');
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    const handleAddField = async (e) => {
        e.preventDefault();
        if (!selectedDocType) return;
      
        const isEdit = !!newField.id;
        const url = isEdit
          ? `${API_BASE_URL}/document-types/fields/${newField.id}`
          : `${API_BASE_URL}/document-types/${selectedDocType.id}/fields`;
        const method = isEdit ? 'PUT' : 'POST';
      
        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newField),
          });
      
          if (!res.ok) throw new Error(isEdit ? 'Failed to update field' : 'Failed to add field');
      
          alert(isEdit ? 'Field updated successfully!' : 'Field added successfully!');
          setShowAddFieldModal(false);
          setNewField({ name: '', displayName: '', dataType: 'string', required: false, orderIndex: 0 });
          fetchDocumentTypes();
        } catch (err) {
          alert(err.message);
        }
      };
      
  
    return (
      <div className="p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Document Types</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : 'Add Document Type'}
          </button>
        </div>
  
        {/* --- Add New Document Type Form --- */}
        {showAddForm && (
          <form
            onSubmit={handleAddDocumentType}
            className="bg-white border border-gray-200 rounded-lg p-6 mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  type="text"
                  value={newDocType.code}
                  onChange={(e) => setNewDocType({ ...newDocType, code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newDocType.name}
                  onChange={(e) => setNewDocType({ ...newDocType, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newDocType.description}
                  onChange={(e) => setNewDocType({ ...newDocType, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Example JSON</label>
                <textarea
                  value={newDocType.example}
                  onChange={(e) => setNewDocType({ ...newDocType, example: e.target.value })}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Document Type'}
              </button>
            </div>
          </form>
        )}
  
        {/* --- List of Document Types --- */}
        <div className="grid gap-4">
          {Array.isArray(documentTypes) && documentTypes.length > 0 ? (
            documentTypes.map((dt) => (
              <div
                key={dt.id || dt.code}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-blue-800">{dt.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">{dt.description}</p>
                    <p className="text-xs text-gray-400">Code: {dt.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedDocType(dt);
                        setShowAddFieldModal(true);
                      }}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                    >
                      + Add Fields
                    </button>
                  </div>
                </div>
  
                {Array.isArray(dt.fields) && dt.fields.length > 0 && (
  <div className="mt-3">
    <h4 className="text-sm font-medium mb-1 text-gray-700">Fields</h4>
    <ul className="text-sm text-gray-600 list-disc list-inside">
      {dt.fields.map((f) => (
        <li
          key={f.id || f.name}
          className="flex justify-between items-center py-1 border-b border-gray-100"
        >
          <div>
            <span className="font-medium">{f.name}</span> — <span>{f.dataType}</span>
            {f.required && <span className="ml-2 text-xs text-red-600">(required)</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedDocType(dt);
                setNewField(f);
                setShowAddFieldModal(true);
              }}
              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
            >
              Edit
            </button>
            <button
              onClick={async () => {
                if (window.confirm(`Delete field "${f.name}"?`)) {
                  try {
                    const res = await fetch(
                      `${API_BASE_URL}/document-types/fields/${f.id}`,
                      { method: 'DELETE' }
                    );
                    if (!res.ok) throw new Error('Failed to delete field');
                    alert('Field deleted');
                    fetchDocumentTypes();
                  } catch (err) {
                    alert(err.message);
                  }
                }
              }}
              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  </div>
)}

              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No document types found.</p>
          )}
        </div>
  
        {/* --- Add Field Modal --- */}
        {showAddFieldModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
              <button
                onClick={() => setShowAddFieldModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold mb-4">
                {newField.id ? 'Edit Field' : 'Add Field'} — {selectedDocType?.name}
            </h3>
  
              <form onSubmit={handleAddField} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Field Name</label>
                  <input
                    type="text"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Display Name</label>
                  <input
                    type="text"
                    value={newField.displayName}
                    onChange={(e) => setNewField({ ...newField, displayName: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Data Type</label>
                  <select
                    value={newField.dataType}
                    onChange={(e) => setNewField({ ...newField, dataType: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  />
                  <label>Required</label>
                </div>
                <div>
                  <label className="block text-sm font-medium">Order Index</label>
                  <input
                    type="number"
                    value={newField.orderIndex}
                    onChange={(e) =>
                      setNewField({ ...newField, orderIndex: parseInt(e.target.value) })
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
  
                <button
                  type="submit"
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Save Field
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  
  

 return (
  <div className="flex h-screen bg-gray-100 relative">
    {/* Sidebar */}
    <div
  className={`bg-[#0f0638] text-white flex flex-col transition-all duration-300 ease-in-out ${
    sidebarOpen ? 'w-64' : 'w-16'
  }`}
>

<div className="relative flex items-center justify-between bg-[#0f0638]">
  {sidebarOpen ? (
    <>
      <div className="flex flex-col items-center justify-center w-full py-3">
        <img
          src="/logo.png"
          alt="Meshfold AI"
          className="w-44 h-auto object-contain mx-auto"
        />
      </div>

      <button
        onClick={() => setSidebarOpen(false)}
        className="absolute right-2 top-2 text-gray-300 hover:text-white transition-colors"
        title="Collapse Sidebar"
      >
        ←
      </button>
    </>
  ) : (
    <button
      onClick={() => setSidebarOpen(true)}
      className="text-gray-300 hover:text-white transition-colors mx-auto"
      title="Expand Sidebar"
    >
      ☰
    </button>
  )}
</div>



      {/* Sidebar Navigation */}
      {sidebarOpen && (
        <nav className="flex-1 p-4">
          <button
            onClick={() => setActiveView('upload')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'upload'
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-indigo-800'
            }`}
            >
            <Upload size={20} />
            {sidebarOpen && <span>Upload Document</span>}
        </button>


        <button
            onClick={() => setActiveView('documents')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'documents'
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-indigo-800'
            }`}
            >
            <List size={20} />
            {sidebarOpen && <span>All Documents</span>}
            {documents.length > 0 && sidebarOpen && (
                <span className="ml-auto bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                {documents.length}
                </span>
            )}
        </button>
        <button
            onClick={() => setActiveView('documentTypes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'documentTypes'
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-indigo-800'
            }`}
            >
            <List size={20} />
            {sidebarOpen && <span>Document Types</span>}
        </button>

        <button
            onClick={() => setActiveView('qaReview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeView === 'qaReview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-indigo-800'
            }`}
            >
            <CheckCircle size={20} />
            {sidebarOpen && <span>QA Review</span>}
        </button>


        </nav>
      )}

      {sidebarOpen && (
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          <p className="mt-1">v1.0.0</p>
        </div>
      )}
    </div>

    {/* Main Content Area */}
    <div className="flex-1 overflow-auto transition-all duration-300 ease-in-out">
      {activeView === 'upload' && <UploadView />}
      {activeView === 'documents' && <DocumentsView />}
      {activeView === 'preview' && <PreviewView />}
      {activeView === 'documentTypes' && <DocumentTypesView />}
      {activeView === 'qaReview' && <QaReviewView />}
    </div>
  </div>
);

};

export default OcrApp;