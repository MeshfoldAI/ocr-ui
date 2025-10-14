import React, { useState, useEffect } from "react";
import { FileText, Eye, Download } from "lucide-react";

const API_BASE_URL = "/ocr/v1";
const API_KEY = "mysecret123";

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// Helper to convert base64 to Blob
const base64ToBlob = (base64, mimeType) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: mimeType });
};

// DocumentPreview Component
const DocumentPreview = ({ documentPreview, selectedDocument }) => {
  if (!documentPreview) {
    return (
      <div className="text-gray-500 text-sm">
        No preview available for this document.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50">
      {documentPreview.contentType?.startsWith("image/") ? (
        <img
          src={`data:${documentPreview.contentType};base64,${documentPreview.base64Content}`}
          alt="Document preview"
          className="w-full h-auto"
        />
      ) : documentPreview.contentType === "application/pdf" ? (
        <div className="bg-white">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              PDF Document Preview
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const blob = base64ToBlob(
                    documentPreview.base64Content,
                    "application/pdf"
                  );
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                <Eye size={14} /> Open in New Tab
              </button>
              <a
                href={`data:${documentPreview.contentType};base64,${documentPreview.base64Content}`}
                download={selectedDocument?.originalFileName}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Download size={14} /> Download
              </a>
            </div>
          </div>

          <iframe
            src={(() => {
              const blob = base64ToBlob(
                documentPreview.base64Content,
                "application/pdf"
              );
              return URL.createObjectURL(blob);
            })()}
            className="w-full h-[700px] border border-gray-300 rounded bg-white"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          <FileText size={48} className="mx-auto mb-2" />
          <p>Preview not available for this file type</p>
        </div>
      )}
    </div>
  );
};

// Custom JSON Editor Component with Review Support
const JsonEditor = ({ value, onChange, onFieldReview, fieldReviews = [] }) => {
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState('');
  const [hoveredPath, setHoveredPath] = useState(null);

  useEffect(() => {
    setJsonString(JSON.stringify(value, null, 2));
    setError('');
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setJsonString(newValue);
    
    try {
      const parsed = JSON.parse(newValue);
      setError('');
      onChange(parsed);
    } catch (err) {
      setError(err.message);
    }
  };

  // Render JSON with clickable fields for review
  const renderJsonWithReview = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return null;

    return Object.entries(obj).map(([key, val]) => {
      const currentPath = path ? `${path}.${key}` : key;
      const review = fieldReviews.find(r => r.fieldName === currentPath);
      const hasReview = !!review;
      const isIncorrectField = review?.incorrect;

      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return (
          <div key={currentPath} className="ml-3 my-2 border-l-2 border-blue-700 pl-3">
            <div className="text-blue-400 font-bold text-sm mb-1">{key}:</div>
            {renderJsonWithReview(val, currentPath)}
          </div>
        );
      }

      return (
        <div
          key={currentPath}
          className={`flex items-center justify-between py-2.5 px-3 my-1 rounded-lg group hover:bg-gray-700 transition border ${
            isIncorrectField 
              ? 'bg-red-900 bg-opacity-40 border-red-600' 
              : 'bg-gray-800 border-gray-700 hover:border-blue-600'
          }`}
          onMouseEnter={() => setHoveredPath(currentPath)}
          onMouseLeave={() => setHoveredPath(null)}
        >
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold text-sm">{key}:</span>
              {hasReview && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-gray-900 font-medium">
                  Reviewed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-base font-medium ${
                isIncorrectField 
                  ? 'line-through text-red-400' 
                  : 'text-white'
              }`}>
                {String(val) || '(empty)'}
              </span>
              {isIncorrectField && review.correctedValue && (
                <div className="flex items-center gap-1">
                  <span className="text-green-400 text-lg">→</span>
                  <span className="text-green-300 font-semibold text-base">
                    {review.correctedValue}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => onFieldReview(currentPath, val)}
            className={`ml-3 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md transition ${
              hoveredPath === currentPath 
                ? 'opacity-100 shadow-lg' 
                : 'opacity-0 group-hover:opacity-100'
            } hover:bg-blue-700`}
          >
            Review
          </button>
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      <div className="flex-1 overflow-auto p-4">
        {renderJsonWithReview(value)}
      </div>
      <div className="border-t border-gray-700 p-3 bg-gray-900">
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-300 font-medium">
            📝 Show Raw JSON Editor
          </summary>
          <textarea
            value={jsonString}
            onChange={handleChange}
            className="w-full mt-3 p-3 font-mono text-xs bg-gray-950 text-gray-100 border border-gray-700 rounded-lg resize-none focus:border-blue-500 focus:outline-none"
            style={{
              fontFamily: "'Fira Code', 'Consolas', monospace",
              lineHeight: "1.6",
            }}
            rows={10}
            spellCheck={false}
          />
        </details>
      </div>
      {error && (
        <div className="bg-red-900 text-red-200 px-4 py-3 text-sm border-t border-red-800 font-medium">
          <span className="font-bold">⚠️ JSON Error:</span> {error}
        </div>
      )}
    </div>
  );
};

const QaReviewView = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [ocrData, setOcrData] = useState({});
  const [reviews, setReviews] = useState([]);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentFieldReview, setCurrentFieldReview] = useState({
    fieldName: '',
    extractedValue: '',
    correctedValue: '',
    comment: '',
    incorrect: false,
    reviewedBy: 'QA_USER'
  });
  const [fieldReviews, setFieldReviews] = useState([]);

  // Fetch documents list
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    fetch(`${API_BASE_URL}/documents`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDocuments(data);
        else if (data?.success && Array.isArray(data.data)) setDocuments(data.data);
        else if (Array.isArray(data.content)) setDocuments(data.content);
        else setDocuments([]);
      })
      .catch((err) => {
        console.error("Error fetching documents:", err);
        setDocuments([]);
      });
  }, []);

  // Load selected document details
  const loadDocument = async (doc) => {
    setSelectedDoc(doc);
    setHasChanges(false);
  
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const previewRes = await fetch(`${API_BASE_URL}/documents/${doc.id}/preview`, { headers });
      const previewData = await previewRes.json();
      if (previewData.success && previewData.data) {
        setDocumentPreview(previewData.data);
      } else {
        setDocumentPreview(null);
      }
  
      const ocrRes = await fetch(`${API_BASE_URL}/documents/${doc.id}/ocr`, { headers });
      const ocrJson = await ocrRes.json();
  
      let structured = {};
      const rawStructured = ocrJson?.data?.structuredJson;
  
      if (rawStructured) {
        try {
          structured = JSON.parse(rawStructured);
        } catch (err) {
          console.error("Error parsing structuredJson:", err);
          structured = { error: "Invalid JSON format", raw: rawStructured };
        }
      } else {
        structured = { message: "No structured JSON available" };
      }
  
      setOcrData(structured);
  
      const reviewRes = await fetch(`${API_BASE_URL}/qa-reviews/${doc.id}`, { headers });
      const reviewData = await reviewRes.json();
      
      if (Array.isArray(reviewData)) {
        setReviews(reviewData);
        setFieldReviews(reviewData);
      } else {
        setReviews([]);
        setFieldReviews([]);
      }
    } catch (err) {
      console.error("Error loading document details:", err);
      setDocumentPreview(null);
      setOcrData({ error: "Failed to load structured JSON" });
    }
  };

  const handleJsonEdit = (updatedJson) => {
    setOcrData(updatedJson);
    setHasChanges(true);
  };

  const openFieldReview = (fieldPath, value) => {
    const existingReview = fieldReviews.find(r => r.fieldName === fieldPath);
    
    if (existingReview) {
      setCurrentFieldReview({
        id: existingReview.id,
        fieldName: fieldPath,
        extractedValue: value,
        correctedValue: existingReview.correctedValue || '',
        comment: existingReview.comment || '',
        incorrect: existingReview.incorrect,
        reviewedBy: existingReview.reviewedBy || 'QA_USER'
      });
    } else {
      setCurrentFieldReview({
        fieldName: fieldPath,
        extractedValue: value,
        correctedValue: '',
        comment: '',
        incorrect: false,
        reviewedBy: 'QA_USER'
      });
    }
    
    setShowReviewModal(true);
  };

  const saveFieldReview = async () => {
    if (!currentFieldReview.fieldName) return;

    setIsSaving(true);
    try {
      const payload = {
        documentId: selectedDoc.id,
        fieldName: currentFieldReview.fieldName,
        extractedValue: currentFieldReview.extractedValue,
        correctedValue: currentFieldReview.correctedValue,
        comment: currentFieldReview.comment,
        incorrect: currentFieldReview.incorrect,
        reviewedBy: currentFieldReview.reviewedBy
      };

      console.log('Sending payload:', payload);

      const response = await fetch(`${API_BASE_URL}/qa-reviews`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const savedReview = await response.json();
        
        setFieldReviews(prev => {
          const filtered = prev.filter(r => r.fieldName !== currentFieldReview.fieldName);
          return [...filtered, savedReview];
        });
        
        alert('✅ Field review saved successfully!');
        setShowReviewModal(false);
        setCurrentFieldReview({
          fieldName: '',
          extractedValue: '',
          correctedValue: '',
          comment: '',
          incorrect: false,
          reviewedBy: 'QA_USER'
        });
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error('Error saving field review:', err);
      alert('❌ Failed to save review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleJsonCorrection = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/json`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ocrData),
      });

      if (response.ok || response.status === 204) {
        setHasChanges(false);
        alert("✅ Corrected JSON saved successfully!");
        // Reload the document to fetch updated data
        await loadDocument(selectedDoc);
      } else {
        throw new Error("Save failed");
      }
    } catch (err) {
      console.error("Error saving corrected JSON:", err);
      alert("❌ Failed to save correction");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">QA Review Dashboard</h2>
          <p className="text-gray-600">Review and correct document extraction results</p>
        </div>

        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
          <div className="col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Documents</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {documents.length}
              </span>
            </div>
            
            {Array.isArray(documents) && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => loadDocument(doc)}
                    className={`cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
                      selectedDoc?.id === doc.id
                        ? "bg-blue-500 text-white border-blue-600 shadow-md"
                        : "bg-white hover:bg-gray-50 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <p className="font-medium text-sm truncate">
                      {doc.name || doc.originalFileName || "Unnamed Document"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${selectedDoc?.id === doc.id ? 'text-blue-100' : 'text-gray-500'}`}>
                        {doc.ocrResults[0]?.docType || "Unknown Type"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2 text-4xl">📄</div>
                <p className="text-gray-500 text-sm">No documents found</p>
              </div>
            )}
          </div>

          <div className="col-span-5 bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-y-auto">
            {selectedDoc && selectedDoc.id ? (
              <DocumentPreview
                documentPreview={documentPreview}
                selectedDocument={selectedDoc}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg">Select a document to view</p>
              </div>
            )}
          </div>

          <div className="col-span-4 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {selectedDoc ? (
              <>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">Structured JSON</h3>
                    {hasChanges && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full animate-pulse">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">
                      {selectedDoc.name || selectedDoc.originalFileName}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="text-gray-500">
                      {selectedDoc.ocrResults[0]?.docType ||  "Unknown Type"}
                    </span>
                  </p>
                </div>

                <div className="flex-1 overflow-hidden">
                  {ocrData && Object.keys(ocrData).length > 0 ? (
                    <JsonEditor 
                      value={ocrData} 
                      onChange={handleJsonEdit}
                      onFieldReview={openFieldReview}
                      fieldReviews={fieldReviews}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 bg-[#1e1e1e]">
                      <div className="text-4xl mb-3">📝</div>
                      <p className="text-sm text-center text-gray-400">No structured JSON available</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-500">
                      {fieldReviews.length > 0 && (
                        <span className="text-blue-600 font-medium">
                          {fieldReviews.length} field(s) reviewed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        alert(`Reviews:\n${fieldReviews.map(r => 
                          `${r.fieldName}: ${r.incorrect ? '❌ Incorrect' : '✓ Correct'}\n  Corrected: ${r.correctedValue || 'N/A'}\n  Comment: ${r.comment || 'N/A'}`
                        ).join('\n\n')}`);
                      }}
                      disabled={fieldReviews.length === 0}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-all duration-200 ${
                        fieldReviews.length === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                      }`}
                    >
                      📋 View All Reviews ({fieldReviews.length})
                    </button>
                    <button
                      disabled={!ocrData || Object.keys(ocrData).length === 0 || isSaving}
                      onClick={handleJsonCorrection}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                        !ocrData || Object.keys(ocrData).length === 0 || isSaving
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : hasChanges
                          ? "bg-green-600 text-white hover:bg-green-700 hover:shadow-md"
                          : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <span>💾</span>
                          Save JSON
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-lg">Select a document</p>
                <p className="text-sm text-gray-500 mt-2">to review structured JSON</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Field Review</h3>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="text-white hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-blue-100 mt-1">
                Review and correct extracted field value
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Name
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-gray-800 font-mono text-sm">
                  {currentFieldReview.fieldName}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extracted Value
                </label>
                <div className="px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-300 text-gray-800">
                  {currentFieldReview.extractedValue || '(empty)'}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="isIncorrect"
                  checked={currentFieldReview.incorrect}
                  onChange={(e) => setCurrentFieldReview({
                    ...currentFieldReview,
                    incorrect: e.target.checked
                  })}
                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="isIncorrect" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Mark as Incorrect
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Check this if the extracted value is wrong
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corrected Value {currentFieldReview.incorrect && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={currentFieldReview.correctedValue}
                  onChange={(e) => setCurrentFieldReview({
                    ...currentFieldReview,
                    correctedValue: e.target.value
                  })}
                  placeholder="Enter the correct value"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!currentFieldReview.incorrect}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (Optional)
                </label>
                <textarea
                  value={currentFieldReview.comment}
                  onChange={(e) => setCurrentFieldReview({
                    ...currentFieldReview,
                    comment: e.target.value
                  })}
                  placeholder="Add any notes or context about this review"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewed By
                </label>
                <input
                  type="text"
                  value={currentFieldReview.reviewedBy}
                  onChange={(e) => setCurrentFieldReview({
                    ...currentFieldReview,
                    reviewedBy: e.target.value
                  })}
                  placeholder="Your name or ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveFieldReview}
                disabled={isSaving || (currentFieldReview.incorrect && !currentFieldReview.correctedValue)}
                className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
                  isSaving || (currentFieldReview.incorrect && !currentFieldReview.correctedValue)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QaReviewView;