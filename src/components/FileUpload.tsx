"use client";

import { useState } from "react";
import { Upload, X, CheckCircle, Loader2, XCircle } from "lucide-react";
import Papa from "papaparse";

type UploadResult = {
  id: number;
  name: string;
  phone: string;
  status: "Pending" | "Triggered" | "Failed";
  message?: string;
};

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith('.csv')) {
        setError("Please upload a valid CSV file.");
        return;
      }
      setFile(selectedFile);
      setError("");
      setUploadSuccess(false);
      setProgress({ current: 0, total: 0 });
      setResults([]);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        try {
          const leads = parsed.data as any[];
          if (!leads || leads.length === 0) throw new Error("No leads found in CSV");
          
          setProgress({ current: 0, total: leads.length });
          
          // Initialize results array
          const initialResults: UploadResult[] = leads.map((lead, i) => ({
            id: i,
            name: lead.Name || lead.name || "Unknown",
            phone: lead.Phone || lead.phone || lead.PhoneNumber || "Unknown",
            status: "Pending"
          }));
          
          setResults(initialResults);
          
          let successCount = 0;
          
          for (let i = 0; i < leads.length; i++) {
            const leadData = leads[i];
            const name = leadData.Name || leadData.name;
            const phone = leadData.Phone || leadData.phone || leadData.PhoneNumber;
            const loanType = leadData.LoanType || leadData['Loan Type'] || leadData.loanType || 'Personal Loan';
            
            if (!name || !phone) {
              setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Failed", message: "Missing Name/Phone" } : r));
              setProgress({ current: i + 1, total: leads.length });
              continue;
            }
            
            try {
              const response = await fetch('/api/leads/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, loanType }),
              });
              
              if (response.ok) {
                successCount++;
                setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Triggered" } : r));
              } else {
                setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Failed", message: "API Error" } : r));
              }
            } catch (triggerError: any) {
              console.error("Failed to trigger lead", i, triggerError);
              setResults(prev => prev.map(r => r.id === i ? { ...r, status: "Failed", message: "Network Error" } : r));
            }
            
            setProgress({ current: i + 1, total: leads.length });
            
            // Wait 2 seconds between calls to respect API rate limits
            if (i < leads.length - 1) {
              await delay(2000); 
            }
          }
          
          setUploadSuccess(true);
          setFile(null);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsUploading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setIsUploading(false);
      }
    });
  };

  const resetUpload = () => {
    setUploadSuccess(false);
    setResults([]);
    setFile(null);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="glass p-8 rounded-xl text-center border-dashed border-2 border-primary/30 relative">
        {file && !isUploading && !uploadSuccess && (
          <button onClick={() => setFile(null)} className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all">
            <X size={16} />
          </button>
        )}
        
        {isUploading ? (
          <Loader2 className="mx-auto h-12 w-12 mb-4 text-primary animate-spin" />
        ) : uploadSuccess ? (
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
        ) : (
          <Upload className={`mx-auto h-12 w-12 mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
        
        <h3 className="text-lg font-medium text-foreground">
          {uploadSuccess ? 'Campaign Completed!' : file ? file.name : 'Upload Leads (CSV)'}
        </h3>
        
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          {isUploading 
            ? `Processing lead ${progress.current} of ${progress.total}... Please do not close this tab.` 
            : uploadSuccess
              ? `Successfully processed ${progress.total} leads.`
              : file 
                ? `${(file.size / 1024).toFixed(2)} KB` 
                : 'Drag and drop your CSV file here. Requires Name, Phone columns.'}
        </p>
        
        {isUploading && progress.total > 0 && (
          <div className="w-full bg-secondary/50 rounded-full h-2.5 mb-6 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
          </div>
        )}
        
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        
        {!file && !uploadSuccess && !isUploading && (
          <div className="relative inline-block">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all pointer-events-none">
              Select CSV File
            </button>
          </div>
        )}

        {file && !isUploading && !uploadSuccess && (
          <button 
            onClick={handleUpload}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
          >
            Confirm & Launch Campaign
          </button>
        )}

        {uploadSuccess && (
          <button 
            onClick={resetUpload}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
          >
            Upload Another Campaign
          </button>
        )}
      </div>

      {(results.length > 0) && (
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-medium mb-4">Processing Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((res) => (
                  <tr key={res.id} className="text-foreground">
                    <td className="py-3">{res.name}</td>
                    <td className="py-3">{res.phone}</td>
                    <td className="py-3">
                      {res.status === "Pending" && <span className="text-yellow-500 flex items-center gap-1"><Loader2 size={14} className="animate-spin"/> Pending</span>}
                      {res.status === "Triggered" && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle size={14}/> Call Triggered</span>}
                      {res.status === "Failed" && <span className="text-red-400 flex items-center gap-1"><XCircle size={14}/> Failed</span>}
                    </td>
                    <td className="py-3 text-muted-foreground">{res.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
