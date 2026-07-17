import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function FileUpload({ files = [], onFilesChange, label = "Files & Documents" }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const newFiles = [];

    try {
      for (const file of selectedFiles) {
        const response = await base44.integrations.Core.UploadFile({ file });
        if (response && response.file_url) {
          newFiles.push({
            name: file.name,
            url: response.file_url,
            type: file.type
          });
        }
      }
      onFilesChange([...files, ...newFiles]);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Error uploading file");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeFile = (index) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  const getFileIcon = (type) => {
    if (type?.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-3">
      <Label className="text-[#e39502] text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</Label>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {files.map((file, index) =>
        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg group">
            <div className="flex items-center gap-3 overflow-hidden">
              {getFileIcon(file.type)}
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 dark:text-slate-300 truncate hover:underline hover:text-blue-600">
                {file.name}
              </a>
            </div>
            <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-red-500"
            onClick={() => removeFile(index)}>

              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
          disabled={uploading} />

        <label htmlFor="file-upload">
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-2 h-20 flex flex-col gap-1 text-slate-500 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-all"
            disabled={uploading}
            asChild>

            <span>
              {uploading ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : <Upload className="w-6 h-6 mb-1" />}
              <span className="text-xs">{uploading ? "Uploading..." : "Click to upload files"}</span>
            </span>
          </Button>
        </label>
      </div>
    </div>);

}