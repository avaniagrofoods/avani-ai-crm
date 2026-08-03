"use client";
import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, UploadCloud, Trash2, FileText, Download } from "lucide-react";

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

export default function GalleryPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}/gallery`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/gallery/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchFiles();
      } else {
        alert("Upload failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      const res = await fetch(`${API_URL}/gallery/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchFiles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6 h-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Media Gallery</h2>
          <p className="text-sm text-zinc-400">View and manage customer documents, Aadhar/PAN cards, and photos sent via WhatsApp.</p>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-12">Loading gallery items...</div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-zinc-800 rounded-xl bg-zinc-900/50 text-zinc-500">
          <ImageIcon className="w-12 h-12 text-zinc-700 mb-3" />
          <h3 className="text-zinc-300 font-medium mb-1">No media found</h3>
          <p className="text-sm text-center max-w-sm mb-4">Upload files here or wait for customers to submit documents via WhatsApp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {files.map((file) => {
            const isImage = file.mimetype?.startsWith('image/');
            return (
              <div key={file.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-colors group">
                <div className="aspect-square bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={file.originalname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-16 h-16 text-zinc-700" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={file.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-zinc-800 rounded-full text-zinc-200 hover:bg-zinc-700 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 bg-red-950 text-red-400 rounded-full hover:bg-red-900/80 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-zinc-200 truncate" title={file.originalname}>
                    {file.originalname}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {formatSize(file.size)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
