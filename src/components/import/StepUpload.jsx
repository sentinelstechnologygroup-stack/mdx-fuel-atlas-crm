import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, FileType } from 'lucide-react';
import { base44 } from "@/api/base44Client";

export default function StepUpload({ onDataParsed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const processFile = async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      // For CSV files, we can parse client-side for speed
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length < 2) throw new Error("File is empty or invalid");
        
        // Simple CSV Parser (handles basic commas)
        // Note: For production with complex CSVs (quoted fields), a library is better, 
        // but we are restricted. We'll use a basic split for now.
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const data = rows.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || "";
                return obj;
            }, {});
        });

        onDataParsed(data, headers, file);
      } else {
        // For Excel, we use the integration
        // 1. Upload
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // 2. Extract (asking for raw array of objects)
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: true
                }
            }
        });

        if (res.status === 'error' || !res.output || !Array.isArray(res.output)) {
            throw new Error("Error parsing file. Please ensure file is valid.");
        }

        const data = res.output;
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        
        onDataParsed(data, headers, file);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading file");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Lead File</h2>
        <p className="text-slate-500">Drag CSV or Excel file here, or click to select</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          w-full max-w-2xl h-64 border-3 border-dashed rounded-2xl flex flex-col items-center justify-center
          transition-all duration-300 cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 scale-105' 
            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}
        `}
        onClick={() => document.getElementById('file-upload').click()}
      >
        <input
          id="file-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files[0] && processFile(e.target.files[0])}
        />

        {isLoading ? (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-medium text-blue-800">Processing data...</p>
            <p className="text-sm text-blue-600">This may take a few seconds</p>
          </div>
        ) : (
          <>
            <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-blue-100' : 'bg-white shadow-sm'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-lg font-medium text-slate-700">Drag file here</p>
            <p className="text-sm text-slate-400 mt-1">Supports CSV, XLSX</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
            <span>{error}</span>
        </div>
      )}
    </div>
  );
}