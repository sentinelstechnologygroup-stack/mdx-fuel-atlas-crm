import React, { useState, useMemo } from 'react';
import { ArrowRight, UploadCloud, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { base44 } from "@/api/base44Client";
import { findBestMatch } from "./StepMapping";

export default function StepPreview({ data, mapping, customLabels, onBack, onImport }) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Normalize and Validate Data
  const processedData = useMemo(() => {
    return data.map((row, index) => {
        const newRow = {};
        const errors = [];

        Object.entries(mapping).forEach(([header, fieldKey]) => {
            let value = row[header];
            if (!value) return;

            // Normalization Logic
            if (fieldKey === 'phone_number') {
                // Remove dashes, spaces
                value = value?.toString().replace(/[- ]/g, '') || "";
            } else if (fieldKey === 'estimated_property_value' || fieldKey === 'age') {
                // Keep only numbers
                value = value?.toString().replace(/[^0-9.]/g, '') || "";
                value = value ? Number(value) : "";
            }

            // Handle collision/merging (especially for notes)
            const label = customLabels?.[header] || header;

            if (newRow[fieldKey]) {
                if (fieldKey === 'notes') {
                    // Append to existing notes with a separator
                    newRow[fieldKey] = `${newRow[fieldKey]} | ${label}: ${value}`;
                } else if (fieldKey === 'phone_number') {
                     newRow[fieldKey] = value;
                } else {
                    newRow[fieldKey] = value;
                }
            } else {
                // First value for this field
                if (fieldKey === 'notes') {
                     // Always use label for notes to be clear, unless it's explicitly the "Notes" column itself
                     // AND the label matches "notes" or "הערות" to avoid redundancy like "Notes: bla bla"
                     const isExplicitNotes = ['notes', 'הערות', 'comment'].includes(label.toLowerCase());
                     
                     if (!isExplicitNotes) {
                         newRow[fieldKey] = `${label}: ${value}`;
                     } else {
                         newRow[fieldKey] = value;
                     }
                } else {
                    newRow[fieldKey] = value;
                }
            }
        });

        // Validation
        if (!newRow.full_name || String(newRow.full_name).length < 2) errors.push("שם לא תקין");
        if (!newRow.phone_number || String(newRow.phone_number).length < 9) errors.push("טלפון לא תקין");

        return { ...newRow, _original: row, _errors: errors, _id: index };
    });
  }, [data, mapping]);

  const validRows = processedData.filter(r => r._errors.length === 0);
  const invalidRows = processedData.filter(r => r._errors.length > 0);

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);

    const batchSize = 50;
    const totalBatches = Math.ceil(validRows.length / batchSize);
    let successCount = 0;
    let failCount = 0;

    try {
        for (let i = 0; i < totalBatches; i++) {
            const batch = validRows.slice(i * batchSize, (i + 1) * batchSize).map(r => {
                // Clean up internal fields
                const { _original, _errors, _id, ...entityData } = r;
                return {
                    ...entityData,
                    lead_status: "New", // Default
                    source_year: new Date().getFullYear().toString(),
                };
            });

            await base44.entities.Lead.bulkCreate(batch);
            
            successCount += batch.length;
            setProgress(Math.round(((i + 1) / totalBatches) * 100));
        }
        
        onImport({ success: successCount, failed: invalidRows.length + failCount, total: processedData.length });

    } catch (error) {
        console.error("Import failed", error);
        // In a real app we would handle partial failures better
    } finally {
        setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-xl font-bold text-slate-800">סקירה ואימות</h2>
            <p className="text-slate-500">סה"כ {processedData.length} רשומות • {validRows.length} תקינות • {invalidRows.length} שגויות</p>
        </div>
        {invalidRows.length > 0 && (
            <div className="text-red-600 bg-red-50 px-3 py-1 rounded text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                שים לב: {invalidRows.length} רשומות לא ייובאו
            </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50">
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">שם מלא</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">עיר</TableHead>
                    <TableHead className="text-right">ערך</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {processedData.slice(0, 10).map((row) => (
                    <TableRow key={row._id} className={row._errors.length > 0 ? "bg-red-50/50" : ""}>
                        <TableCell>
                            {row._errors.length > 0 ? (
                                <div className="flex items-center gap-1 text-red-500" title={row._errors.join(", ")}>
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="text-xs font-bold">שגיאה</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-xs">תקין</span>
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell>{row.phone_number}</TableCell>
                        <TableCell>{row.city || '-'}</TableCell>
                        <TableCell>{row.estimated_property_value ? `₪${row.estimated_property_value.toLocaleString()}` : '-'}</TableCell>
                    </TableRow>
                ))}
                {processedData.length > 10 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 text-sm p-2">
                            ...ועוד {processedData.length - 10} רשומות
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </div>

      {isImporting && (
        <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
                <span>מייבא נתונים...</span>
                <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה
        </Button>
        <Button 
            onClick={handleImport} 
            disabled={isImporting || validRows.length === 0}
            className="bg-blue-600 hover:bg-blue-700 min-w-[150px]"
        >
            {isImporting ? (
                "מעבד..."
            ) : (
                <>
                    ייבא {validRows.length} לידים
                    <UploadCloud className="w-4 h-4 mr-2" />
                </>
            )}
        </Button>
      </div>
    </div>
  );
}