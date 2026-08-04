"use client";

import { useState, useRef } from "react";
import { Image as ImageIcon, UploadCloud, Trash2, FileText, Download, Eye, X } from "lucide-react";

const preconfiguredMedia = [
  { id: "g1", name: "Rahul_Sharma_PAN_Card.pdf", size: "450 KB", type: "PDF", category: "Personal Loan", date: new Date().toISOString() },
  { id: "g2", name: "Priya_Patil_Doctor_Registration.pdf", size: "1.2 MB", type: "PDF", category: "Doctor Loan", date: new Date().toISOString() },
  { id: "g3", name: "Ajay_Tech_GST_Returns_2025.pdf", size: "2.8 MB", type: "PDF", category: "Business Loan", date: new Date().toISOString() },
  { id: "g4", name: "Property_Registry_Document_Latur.pdf", size: "3.5 MB", type: "PDF", category: "Home Loan", date: new Date().toISOString() }
];

export default function GalleryPage() {
  const [files, setFiles] = useState<any[]>(preconfiguredMedia);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];

    const newMedia = {
      id: "media_" + Date.now(),
      name: uploadedFile.name,
      size: (uploadedFile.size / 1024).toFixed(1) + " KB",
      type: uploadedFile.type.includes("pdf") ? "PDF" : "IMAGE",
      category: "WhatsApp Submission",
      date: new Date().toISOString()
    };

    setFiles([newMedia, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6 text-zinc-200 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-purple-400" />
            Media Gallery & Verification Vault
          </h2>
          <p className="text-sm text-zinc-400 mt-1">View customer PAN, Aadhaar, salary slips, and property documents submitted via WhatsApp.</p>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-purple-500/20"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {files.map((file) => (
          <div key={file.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors shadow-md">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {file.category}
                </span>
                <span className="text-xs font-mono text-zinc-500">{file.type}</span>
              </div>
              <div className="flex items-center gap-3 my-3">
                <FileText className="w-8 h-8 text-purple-400 shrink-0" />
                <h4 className="font-bold text-white text-sm truncate" title={file.name}>{file.name}</h4>
              </div>
              <p className="text-xs text-zinc-500">File Size: {file.size}</p>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800/80">
              <button 
                onClick={() => setSelectedFile(file)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
              >
                <Eye className="w-3.5 h-3.5" /> View
              </button>
              <button 
                onClick={() => handleDelete(file.id)}
                className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-400/10 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Document View Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                {selectedFile.name}
              </h3>
              <button onClick={() => setSelectedFile(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p><strong className="text-white">Category:</strong> {selectedFile.category}</p>
              <p><strong className="text-white">Document Size:</strong> {selectedFile.size}</p>
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center font-mono text-emerald-400">
                ✅ Document Verified & Encrypted in AVANI Storage
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => setSelectedFile(null)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
