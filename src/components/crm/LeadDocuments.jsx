import React from "react";
import { Button } from "@/components/ui/button";
import FileUpload from "../common/FileUpload";

export default function LeadDocuments({ lead, documents, onDocumentsChange, onSave, onCancel, isSubmitting, theme }) {
    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <FileUpload
                    files={documents || []}
                    onFilesChange={onDocumentsChange} 
                />
            </div>
            
            <div className={`flex justify-end gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                <Button type="button" variant="outline" onClick={onCancel} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}>Cancel</Button>
                <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                    {lead ? "Save Changes" : "Create Lead"}
                </Button>
            </div>
        </div>
    );
}