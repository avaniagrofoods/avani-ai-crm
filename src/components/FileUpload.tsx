"use client";

import { useState } from "react";
import { Upload, X, CheckCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const leads = results.data as any[];
          if (!leads || leads.length === 0) throw new Error("No leads found in CSV");
          
          setProgress({ current: 0, total: leads.length });
          
          let successCount = 0;
          
          // Loop through each lead one by one to prevent Vercel Serverless timeout 
          // and VAPI rate limits on large CSV files (e.g. 100+ calls)
          for (let i = 0; i < leads.length; i++) {
            const leadData = leads[i];
            const name = leadData.Name || leadData.name;
            const phone = leadData.Phone || leadData.phone || leadData.PhoneNumber;
            const loanType = leadData.LoanType || leadData['Loan Type'] || leadData.loanType;
            
            if (!name || !phone) continue;
            
            try {
              const response = await fetch('/api/leads/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, loanType }),
              });
              
              if (response.ok) {
                successCount++;
              }
            } catch (triggerError) {
              console.error("Failed to trigger lead", i, triggerError);
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

  if (uploadSuccess) {
    return (
      <div className="glass p-8 rounded-xl text-center border-2 border-emerald-500/30 bg-emerald-500/5">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Campaign Completed!</h3>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">Successfully processed {progress.total} leads. Calls are being made!</p>
        <button onClick={() => setUploadSuccess(false)} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-all">
          Upload Another Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="glass p-8 rounded-xl text-center border-dashed border-2 border-primary/30 relative">
      {file && !isUploading && (
        <button onClick={() => setFile(null)} className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all">
          <X size={16} />
        </button>
      )}
      
      {isUploading ? (
        <Loader2 className="mx-auto h-12 w-12 mb-4 text-primary animate-spin" />
      ) : (
        <Upload className={`mx-auto h-12 w-12 mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
      )}
      
      <h3 className="text-lg font-medium text-foreground">
        {file ? file.name : 'Upload Leads (CSV)'}
      </h3>
      
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        {isUploading 
          ? `Processing lead ${progress.current} of ${progress.total}... Please do not close this tab.` 
          : file 
            ? `${(file.size / 1024).toFixed(2)} KB` 
            : 'Drag and drop your CSV file here. Supports large lists safely.'}
      </p>
      
      {isUploading && progress.total > 0 && (
        <div className="w-full bg-secondary/50 rounded-full h-2.5 mb-6 overflow-hidden">
          <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
        </div>
      )}
      
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      
      {!file ? (
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
      ) : (
        <button 
          onClick={handleUpload}
          disabled={isUploading}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
        >
          {isUploading ? `Calling... (${progress.current}/${progress.total})` : 'Confirm & Launch Campaign'}
        </button>
      )}
    </div>
  );
}
