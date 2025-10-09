import React from "react";
import { FileText, Eye, Download } from "lucide-react";

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

export default DocumentPreview;
