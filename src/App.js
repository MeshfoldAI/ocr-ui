import React, { useState, useEffect } from 'react';
import { Upload, FileText, List, Eye, CheckCircle, Clock, XCircle, AlertCircle, Download, Trash2, LogOut, User } from 'lucide-react';
import QaReviewView from "./QaReviewView";
import Login from "./Login";


const API_BASE_URL = '/ocr/v1/documents';
const TEMPLATES_API_URL = '/ocr/v1/prompt-templates';

// Local development mode - disable authentication when running on localhost
const IS_LOCAL_MODE = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';

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
  const [isAuthenticated, setIsAuthenticated] = useState(IS_LOCAL_MODE);
  const [userInfo, setUserInfo] = useState(IS_LOCAL_MODE ? { 
    fullName: 'Local User', 
    email: 'local@dev.com',
    role: 'DEVELOPER' 
  } : null);
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [tokenRefreshNotification, setTokenRefreshNotification] = useState(false);
  const [reEnhancing, setReEnhancing] = useState(false);

  // Check for existing authentication on mount
  useEffect(() => {
    // Skip authentication check if in local mode
    if (IS_LOCAL_MODE) {
      console.log('🔓 Local mode detected - authentication disabled');
      setIsAuthenticated(true);
      return;
    }

    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const savedUserInfo = localStorage.getItem('userInfo');
    
    if (token) {
      // Check if token has expired
      if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
        console.log('Token has expired, logging out...');
        handleLogout();
        return;
      }
      
      setIsAuthenticated(true);
      if (savedUserInfo) {
        try {
          setUserInfo(JSON.parse(savedUserInfo));
        } catch (e) {
          console.error('Error parsing user info:', e);
        }
      }
    }
  }, []);

  // Check token expiry and refresh proactively (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated || IS_LOCAL_MODE) return;

    let refreshInProgress = false;

    const checkAndRefreshToken = async () => {
      // Prevent multiple simultaneous refresh attempts
      if (refreshInProgress) {
        console.log('🔄 Token refresh already in progress, skipping...');
        return;
      }

      const tokenExpiry = localStorage.getItem('tokenExpiry');
      
      if (!tokenExpiry) {
        console.log('⚠️ No token expiry found');
        return;
      }
      
      const expiryTime = parseInt(tokenExpiry);
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
      
      console.log(`🕐 Token expires in ${minutesUntilExpiry} minutes (${Math.floor(timeUntilExpiry / 1000)} seconds)`);
      
      // If token has already expired
      if (timeUntilExpiry <= 0) {
        console.log('❌ Token has expired, attempting refresh...');
        refreshInProgress = true;
        const refreshed = await refreshAccessToken();
        refreshInProgress = false;
        
        if (!refreshed) {
          alert('Your session has expired. Please login again.');
          handleLogout();
        }
      }
      // If token will expire in less than 10 minutes, proactively refresh
      else if (timeUntilExpiry < 600000) { // 10 minutes = 600000ms
        console.log(`🔄 Token expiring in ${minutesUntilExpiry} minutes, proactively refreshing...`);
        refreshInProgress = true;
        const refreshed = await refreshAccessToken();
        refreshInProgress = false;
        if (!refreshed) {
          console.warn('⚠️ Proactive token refresh failed, will retry next cycle');
        }
      }
    };

    // Check immediately on mount
    checkAndRefreshToken();
    
    // Then check every 5 minutes (300000ms) instead of every minute
    const interval = setInterval(checkAndRefreshToken, 300000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  // Token refresh function with cooldown
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      console.error('❌ No refresh token available for token refresh');
      return false;
    }

    // Check if we recently refreshed (within last 2 minutes)
    const lastRefresh = localStorage.getItem('lastTokenRefresh');
    if (lastRefresh && Date.now() - parseInt(lastRefresh) < 120000) {
      console.log('🔄 Token refresh skipped - recently refreshed');
      return true;
    }

    try {
      console.log('🔄 Attempting to refresh access token...');
      setTokenRefreshNotification(true);
      
      const response = await fetch('/auth/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.accessToken) {
          // Update tokens in localStorage
          localStorage.setItem('authToken', data.accessToken);
          console.log('✅ New access token stored');
          
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
            console.log('✅ New refresh token stored');
          }
          
          if (data.expiresIn) {
            const expiryTime = Date.now() + (data.expiresIn * 1000);
            localStorage.setItem('tokenExpiry', expiryTime.toString());
            console.log(`✅ Token will expire in ${data.expiresIn} seconds (${Math.floor(data.expiresIn / 60)} minutes)`);
          }
          
          if (data.user) {
            localStorage.setItem('userInfo', JSON.stringify(data.user));
            setUserInfo(data.user);
          }
          
          console.log('✅ Access token refreshed successfully');
          
          // Record the last refresh time
          localStorage.setItem('lastTokenRefresh', Date.now().toString());
          
          // Hide notification after 2 seconds
          setTimeout(() => setTokenRefreshNotification(false), 2000);
          
          return true;
        } else {
          console.error('❌ Token refresh response missing accessToken');
          setTokenRefreshNotification(false);
          return false;
        }
      } else {
        console.error(`❌ Token refresh failed with status: ${response.status}`);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setTokenRefreshNotification(false);
        return false;
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      setTokenRefreshNotification(false);
      return false;
    }
  };

  // Helper function for authenticated fetch with automatic token refresh and logout on 401
  const authenticatedFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');
    const headers = {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      console.log('Received 401, attempting token refresh...');
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Retry the request with new token
        const newToken = localStorage.getItem('authToken');
        const newHeaders = {
          ...(newToken && { 'Authorization': `Bearer ${newToken}` }),
          ...options.headers,
        };
        
        const retryResponse = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
        
        if (retryResponse.ok) {
          return retryResponse;
        }
      }
      
      // If refresh failed or retry still unauthorized, log out
      console.log('Token refresh failed or retry unsuccessful, logging out...');
      alert('Your session has expired. Please login again.');
      handleLogout();
      throw new Error('Unauthorized - session expired');
    }

    return response;
  };

  // Login handler
  const handleLoginSuccess = (data) => {
    setIsAuthenticated(true);
    if (data.user) {
      setUserInfo(data.user);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    // In local mode, just refresh the page
    if (IS_LOCAL_MODE) {
      console.log('🔓 Local mode - refreshing page instead of logout');
      window.location.reload();
      return;
    }

    setIsLoggingOut(true);
    const token = localStorage.getItem('authToken');
    
    // Call backend logout API if token exists
    if (token) {
      try {
        await fetch('/auth/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('Successfully logged out from server');
      } catch (error) {
        console.error('Error calling logout API:', error);
        // Continue with local logout even if API call fails
      }
    }
    
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userInfo');
    
    // Reset application state
    setIsAuthenticated(false);
    setUserInfo(null);
    setDocuments([]);
    setSelectedDocument(null);
    setOcrResult(null);
    setDocumentPreview(null);
    setActiveView('upload');
    setIsLoggingOut(false);
  };

  // Helper to get authorization headers
  const getAuthHeader = () => {
    const token = localStorage.getItem('authToken');
    console.log('Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    if (!token) {
      console.warn('⚠️ No auth token found in localStorage');
    }
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Fetch documents function
  const fetchDocuments = async () => {
    try {
      const headers = getAuthHeader();
      console.log('Fetching documents with headers:', headers);
      const response = await fetch(`${API_BASE_URL}`, {
        headers,
      });
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Fetch documents on mount (only when authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  // Auto-refresh documents
  useEffect(() => {
    if (isAuthenticated && autoRefresh && activeView === 'documents') {
      const interval = setInterval(fetchDocuments, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, autoRefresh, activeView]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const handleFileUpload = async (file, processImmediately = false) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = processImmediately ? '/upload-and-process' : '/upload';
      const authHeaders = getAuthHeader();
      console.log('Uploading file with auth headers:', authHeaders);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders,
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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
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

  const reEnhanceDocument = async (documentId, e) => {
    e?.stopPropagation(); // Ensure card click never fires
    if (!window.confirm('Are you sure you want to re-enhance this document?')) return;
    
    setReEnhancing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/${documentId}/re-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('Re-enhancement started successfully!');
        await fetchDocuments(); // refresh documents list
        
        // If we're in preview view, refresh the document details
        if (selectedDocument && selectedDocument.id === documentId) {
          await viewDocumentDetails(selectedDocument);
        }
      } else {
        alert('Re-enhancement failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error re-enhancing document: ' + error.message);
    } finally {
      setReEnhancing(false);
    }
  };
  

  const viewDocumentDetails = async (document) => {
    setLoading(true);
    setSelectedDocument(document);
    setActiveView('preview');

    try {
      const headers = getAuthHeader();

      const previewResponse = await fetch(`${API_BASE_URL}/${document.id}/preview`, { headers });
      const previewData = await previewResponse.json();
      if (previewData.success) {
        setDocumentPreview(previewData.data);
      }

      if (document.status === 'COMPLETED') {
        const ocrResponse = await fetch(`${API_BASE_URL}/${document.id}/ocr`, { headers });
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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
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
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setActiveView('documents');
            setSelectedDocument(null);
            setOcrResult(null);
            setDocumentPreview(null);
          }}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
        >
          ← Back to Documents
        </button>
        {selectedDocument && (
          <button
            onClick={(e) => reEnhanceDocument(selectedDocument.id, e)}
            disabled={reEnhancing}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
              reEnhancing 
                ? 'bg-purple-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white`}
          >
            {reEnhancing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Re-enhancing...</span>
              </>
            ) : (
              'Re-enhance Document'
            )}
          </button>
        )}
      </div>
  
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
                            return Object.entries(obj).map(([key, value], index) => {
                            const formattedKey = key.replace(/_/g, ' ');
                            const padding = { paddingLeft: `${level * 16}px` };

                            // Handle arrays
                            if (Array.isArray(value)) {
                                return (
                                <div key={`${key}-${index}`} style={padding} className="mb-3">
                                    <p className="font-medium text-indigo-900 capitalize mb-1">
                                    {formattedKey} ({value.length})
                                    </p>
                                    <div className="ml-2 border-l-2 border-indigo-300 pl-3 space-y-2">
                                    {value.map((item, idx) => (
                                        <div key={idx} className="bg-indigo-100 rounded p-2">
                                        <p className="text-xs font-semibold text-indigo-700 mb-1">
                                            Item {idx + 1}
                                        </p>
                                        {typeof item === 'object' && item !== null ? (
                                            renderObject(item, level + 1)
                                        ) : (
                                            <span className="text-indigo-800 text-sm">{String(item)}</span>
                                        )}
                                        </div>
                                    ))}
                                    </div>
                                </div>
                                );
                            }
                            // Handle nested objects
                            else if (value && typeof value === 'object') {
                                return (
                                <div key={`${key}-${index}`} style={padding} className="mb-2">
                                    <p className="font-medium text-indigo-900 capitalize">
                                    {formattedKey}
                                    </p>
                                    <div className="ml-2 border-l border-indigo-200 pl-3">
                                    {renderObject(value, level + 1)}
                                    </div>
                                </div>
                                );
                            }
                            // Handle primitive values
                            else {
                                return (
                                <div
                                    key={`${key}-${index}`}
                                    style={padding}
                                    className="flex justify-between border-b border-indigo-100 py-1"
                                >
                                    <span className="text-indigo-900 capitalize">{formattedKey}</span>
                                    <span className="text-indigo-800 text-right break-all">
                                    {value === null ? 'null' : String(value)}
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
    const [templates, setTemplates] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplate, setNewTemplate] = useState({
      code: '',
      name: '',
      description: '',
      systemInstructions: '',
      specificInstructions: '',
      expectedFields: '',
      exampleOutput: '',
      isActive: true,
    });
    const [loading, setLoading] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [activeOnlyFilter, setActiveOnlyFilter] = useState(false);
  
    const fetchTemplates = async () => {
      try {
        const url = `${TEMPLATES_API_URL}${activeOnlyFilter ? '?activeOnly=true' : ''}`;
        const res = await fetch(url, {
          headers: getAuthHeader(),
        });
        const data = await res.json();
  
        if (data.success && Array.isArray(data.data)) {
          setTemplates(data.data);
        } else if (Array.isArray(data)) {
          setTemplates(data);
        } else {
          setTemplates([]);
        }
      } catch (err) {
        console.error('Error fetching templates:', err);
        setTemplates([]);
      }
    };
  
    useEffect(() => {
      fetchTemplates();
    }, [activeOnlyFilter]);
  
    const handleSubmitTemplate = async (e) => {
      e.preventDefault();
      setLoading(true);
  
      try {
        const isEdit = !!editingTemplate;
        const url = isEdit 
          ? `${TEMPLATES_API_URL}/${editingTemplate.id}`
          : TEMPLATES_API_URL;
        const method = isEdit ? 'PUT' : 'POST';
  
        const res = await fetch(url, {
          method,
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify(newTemplate),
        });
  
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.message || `Failed to ${isEdit ? 'update' : 'add'} template`);
        }
  
        setNewTemplate({
          code: '',
          name: '',
          description: '',
          systemInstructions: '',
          specificInstructions: '',
          expectedFields: '',
          exampleOutput: '',
          isActive: true,
        });
        setEditingTemplate(null);
        setShowAddForm(false);
        fetchTemplates();
        alert(`Template ${isEdit ? 'updated' : 'added'} successfully!`);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    const handleEdit = (template) => {
      setEditingTemplate(template);
      setNewTemplate({
        code: template.code || '',
        name: template.name || '',
        description: template.description || '',
        systemInstructions: template.systemInstructions || '',
        specificInstructions: template.specificInstructions || '',
        expectedFields: template.expectedFields || '',
        exampleOutput: template.exampleOutput || '',
        isActive: template.isActive !== undefined ? template.isActive : true,
      });
      setShowAddForm(true);
    };
  
    const handleDelete = async (template) => {
      if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
        return;
      }
  
      try {
        const res = await fetch(`${TEMPLATES_API_URL}/${template.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        });
  
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to delete template');
        }
  
        alert('Template deleted successfully!');
        fetchTemplates();
      } catch (err) {
        alert(err.message);
      }
    };
  
    const handleToggleActive = async (template) => {
      try {
        const action = template.isActive ? 'deactivate' : 'activate';
        const res = await fetch(`${TEMPLATES_API_URL}/code/${template.code}/${action}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        });
  
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || `Failed to ${action} template`);
        }
  
        alert(`Template ${action}d successfully!`);
        fetchTemplates();
      } catch (err) {
        alert(err.message);
      }
    };
  
    const handleViewDetails = (template) => {
      setSelectedTemplate(template);
      setShowViewModal(true);
    };
  
    const handleRefreshCache = async () => {
      try {
        const res = await fetch(`${TEMPLATES_API_URL}/refresh-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        });
  
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to refresh cache');
        }
  
        alert('Template cache refreshed successfully!');
      } catch (err) {
        alert(err.message);
      }
    };
  
    const parseExpectedFields = (fieldsJson) => {
      try {
        if (!fieldsJson) return [];
        const parsed = JSON.parse(fieldsJson);
        return Object.entries(parsed).map(([key, value]) => ({
          name: key,
          type: typeof value === 'string' ? value : JSON.stringify(value),
        }));
      } catch (e) {
        return [];
      }
    };
  
    return (
      <div className="p-6 relative">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Document Type Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage dynamic prompt templates for OCR document processing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveOnlyFilter(!activeOnlyFilter)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeOnlyFilter 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {activeOnlyFilter ? 'Show All' : 'Active Only'}
            </button>
            <button
              onClick={handleRefreshCache}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              Refresh Cache
            </button>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (showAddForm) {
                  setEditingTemplate(null);
                  setNewTemplate({
                    code: '',
                    name: '',
                    description: '',
                    systemInstructions: '',
                    specificInstructions: '',
                    expectedFields: '',
                    exampleOutput: '',
                    isActive: true,
                  });
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : '+ Add Template'}
            </button>
          </div>
        </div>
  
        {/* Add/Edit Template Form */}
        {showAddForm && (
          <form
            onSubmit={handleSubmitTemplate}
            className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">
              {editingTemplate ? 'Edit Template' : 'Add New Template'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTemplate.code}
                  onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., medical_prescription"
                  required
                  disabled={!!editingTemplate}
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (lowercase, underscores)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Medical Prescription"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Describe the document type..."
                  rows={2}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  System Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newTemplate.systemInstructions}
                  onChange={(e) => setNewTemplate({ ...newTemplate, systemInstructions: e.target.value })}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  placeholder="You are an expert in..."
                  rows={3}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Define the AI's role and expertise</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Specific Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newTemplate.specificInstructions}
                  onChange={(e) => setNewTemplate({ ...newTemplate, specificInstructions: e.target.value })}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  placeholder="1. Extract field A&#10;2. Normalize dates to YYYY-MM-DD&#10;3. Handle missing values..."
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Step-by-step extraction guidelines</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Expected Fields (JSON Schema) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newTemplate.expectedFields}
                  onChange={(e) => setNewTemplate({ ...newTemplate, expectedFields: e.target.value })}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  placeholder='{\n  "field_name": "string",\n  "date": "YYYY-MM-DD",\n  "amount": "number"\n}'
                  rows={5}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Valid JSON format with field types</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Example Output (JSON) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newTemplate.exampleOutput}
                  onChange={(e) => setNewTemplate({ ...newTemplate, exampleOutput: e.target.value })}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  placeholder='{\n  "field_name": "Example Value",\n  "date": "2024-03-15",\n  "amount": 100.50\n}'
                  rows={5}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Example JSON output for reference</p>
              </div>
              
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newTemplate.isActive}
                  onChange={(e) => setNewTemplate({ ...newTemplate, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Active (Template will be available for use)
                </label>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingTemplate(null);
                  setNewTemplate({
                    code: '',
                    name: '',
                    description: '',
                    systemInstructions: '',
                    specificInstructions: '',
                    expectedFields: '',
                    exampleOutput: '',
                    isActive: true,
                  });
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
  
        {/* Templates List */}
        <div className="grid gap-4">
          {Array.isArray(templates) && templates.length > 0 ? (
            templates.map((template) => (
              <div
                key={template.id || template.code}
                className={`bg-white border rounded-lg p-4 hover:shadow-md transition ${
                  !template.isActive ? 'border-gray-300 bg-gray-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-blue-800">{template.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          template.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {template.code}
                      </span>
                      {template.createdAt && (
                        <span>Created: {formatDateTime(template.createdAt)}</span>
                      )}
                      {template.updatedAt && (
                        <span>Updated: {formatDateTime(template.updatedAt)}</span>
                      )}
                    </div>
                    
                    {/* Expected Fields Preview */}
                    {template.expectedFields && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">Expected Fields:</h4>
                        <div className="flex flex-wrap gap-1">
                          {parseExpectedFields(template.expectedFields).slice(0, 5).map((field, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
                            >
                              {field.name}: {field.type}
                            </span>
                          ))}
                          {parseExpectedFields(template.expectedFields).length > 5 && (
                            <span className="text-xs text-gray-500">
                              +{parseExpectedFields(template.expectedFields).length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleViewDetails(template)}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200 flex items-center gap-1"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`px-3 py-1 rounded text-sm ${
                        template.isActive
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {template.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <FileText className="mx-auto mb-4 text-gray-300" size={64} />
              <p className="text-gray-500">No templates found.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Template
              </button>
            </div>
          )}
        </div>
  
        {/* View Template Details Modal */}
        {showViewModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto relative">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                <h3 className="text-xl font-semibold">{selectedTemplate.name}</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-500 hover:text-gray-800 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Code:</h4>
                  <p className="font-mono bg-gray-100 px-3 py-2 rounded text-sm">{selectedTemplate.code}</p>
                </div>
                
                {selectedTemplate.description && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Description:</h4>
                    <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Status:</h4>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      selectedTemplate.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {selectedTemplate.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">System Instructions:</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                      {selectedTemplate.systemInstructions}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Specific Instructions:</h4>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                      {selectedTemplate.specificInstructions}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Expected Fields (JSON Schema):</h4>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                      {selectedTemplate.expectedFields}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Example Output:</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800">
                      {selectedTemplate.exampleOutput}
                    </pre>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="font-semibold text-xs text-gray-600 mb-1">Created:</h4>
                    <p className="text-sm">{formatDateTime(selectedTemplate.createdAt)}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-gray-600 mb-1">Updated:</h4>
                    <p className="text-sm">{formatDateTime(selectedTemplate.updatedAt)}</p>
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedTemplate);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Template
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
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
            <FileText size={20} />
            {sidebarOpen && <span>Template Manager</span>}
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
        <div className="p-4 border-t border-indigo-900">
          {/* User Info */}
          <div className="mb-3 p-3 bg-indigo-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {userInfo?.fullName || userInfo?.firstName || userInfo?.email || 'User'}
                </p>
                {userInfo?.email && (
                  <p className="text-xs text-gray-300 truncate">
                    {userInfo.email}
                  </p>
                )}
                {userInfo?.role && (
                  <p className="text-xs text-blue-300 truncate">
                    {userInfo.role}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isLoggingOut 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : IS_LOCAL_MODE 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {isLoggingOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Logging out...</span>
                </>
              ) : IS_LOCAL_MODE ? (
                <>
                  <Clock size={16} />
                  <span>Refresh</span>
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  <span>Logout</span>
                </>
              )}
            </button>
          </div>
          
          {/* Version */}
          <p className="text-xs text-gray-400 text-center">v1.0.0</p>
        </div>
      )}
    </div>

    {/* Main Content Area */}
    <div className="flex-1 overflow-auto transition-all duration-300 ease-in-out">
      {/* Local Mode Banner */}
      {IS_LOCAL_MODE && (
        <div className="bg-yellow-100 border-b-2 border-yellow-400 px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-yellow-800">
            <AlertCircle size={18} />
            <span className="font-medium text-sm">
              🔓 Local Development Mode - Authentication Disabled
            </span>
          </div>
        </div>
      )}
      
      {activeView === 'upload' && <UploadView />}
      {activeView === 'documents' && <DocumentsView />}
      {activeView === 'preview' && <PreviewView />}
      {activeView === 'documentTypes' && <DocumentTypesView />}
      {activeView === 'qaReview' && <QaReviewView />}
    </div>

    {/* Token Refresh Notification */}
    {tokenRefreshNotification && (
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span className="text-sm font-medium">Refreshing session...</span>
      </div>
    )}
  </div>
);

};

export default OcrApp;