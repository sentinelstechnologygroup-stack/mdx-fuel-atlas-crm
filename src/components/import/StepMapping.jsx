import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// CRM Fields Definition
const CRM_FIELDS = [
  { key: 'full_name', label: 'שם מלא', required: true },
  { key: 'phone_number', label: 'טלפון', required: true },
  { key: 'email', label: 'אימייל', required: false },
  { key: 'city', label: 'עיר', required: false },
  { key: 'age', label: 'גיל', required: false },
  { key: 'estimated_property_value', label: 'שווי נכס', required: false },
  { key: 'notes', label: 'הערות', required: false },
];

// Fuzzy Matching Logic (Levenshtein Distance)
const getLevenshteinDistance = (a, b) => {
  if (!a || !b) return 100;
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
};

// Exporting for use in other files if needed, but kept internal here
export const findBestMatch = (header, fields) => {
  let bestMatch = null;
  let minDistance = Infinity;

  // Aliases for smarter matching
  const aliases = {
    'full_name': ['name', 'client', 'customer', 'שם', 'לקוח', 'שם הלקוח'],
    'phone_number': ['phone', 'mobile', 'cell', 'tel', 'טלפון', 'נייד', 'טלפון 1', 'טלפון 2', 'Phone 1', 'Phone 2'],
    'city': ['address', 'location', 'town', 'עיר', 'כתובת'],
    'estimated_property_value': ['value', 'price', 'worth', 'property', 'שווי', 'נכס'],
    'age': ['old', 'years', 'גיל'],
    'email': ['mail', 'אימייל', 'דואר'],
    'notes': ['comment', 'info', 'הערות', 'פרטים', 'remarks']
  };

  fields.forEach(field => {
    // Check direct match or aliases
    const candidates = [field.label, field.key, ...(aliases[field.key] || [])];
    
    candidates.forEach(candidate => {
        const distance = getLevenshteinDistance(header, candidate);
        // Threshold logic: if string is short, exact match matters more
        const threshold = Math.max(2, Math.floor(candidate.length / 2));
        
        if (distance <= threshold && distance < minDistance) {
            minDistance = distance;
            bestMatch = field.key;
        }
    });
  });

  return bestMatch;
};

export default function StepMapping({ headers, onBack, onNext }) {
  const [mapping, setMapping] = useState({});
  const [customLabels, setCustomLabels] = useState({});

  // Run Auto-Mapping on mount
  useEffect(() => {
    const newMapping = {};
    const newCustomLabels = {};
    headers.forEach(header => {
        const match = findBestMatch(header, CRM_FIELDS);
        if (match) {
            newMapping[header] = match;
        } else {
            // Fallback: Map unidentified columns to 'notes'
            newMapping[header] = 'notes';
        }
        // Default custom label is the header itself
        newCustomLabels[header] = header;
    });
    setMapping(newMapping);
    setCustomLabels(newCustomLabels);
  }, [headers]);

  const handleMapChange = (header, fieldKey) => {
    if (fieldKey === 'ignore') {
        const newMap = { ...mapping };
        delete newMap[header];
        setMapping(newMap);
    } else {
        setMapping({ ...mapping, [header]: fieldKey });
    }
  };

  const isMapped = (header) => !!mapping[header];
  const getMappedField = (header) => CRM_FIELDS.find(f => f.key === mapping[header]);

  const canProceed = CRM_FIELDS.filter(f => f.required).every(reqField => 
    Object.values(mapping).includes(reqField.key)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">מיפוי עמודות</h2>
        <p className="text-slate-500">התאם את עמודות הקובץ לשדות במערכת</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Required Fields Status */}
        <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-4 items-center">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-blue-800">
                <span className="font-bold">שדות חובה: </span>
                {CRM_FIELDS.filter(f => f.required).map(f => (
                    <span key={f.key} className={`inline-flex items-center ml-2 ${Object.values(mapping).includes(f.key) ? 'text-green-600' : 'text-red-500 font-bold'}`}>
                        {f.label} {Object.values(mapping).includes(f.key) ? <Check className="w-3 h-3" /> : '*'}
                    </span>
                ))}
            </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 md:col-span-2">
            {headers.map((header) => (
                <div key={header} className="flex items-center gap-4 p-3 bg-white border rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                    <div className="flex-1">
                        <Label className="text-xs text-slate-400 mb-1">עמודה בקובץ</Label>
                        <div className="font-medium text-slate-700 flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                            {header}
                        </div>
                    </div>

                    <ArrowRight className={`w-4 h-4 ${isMapped(header) ? 'text-blue-500' : 'text-slate-300'}`} />

                    <div className="flex-1">
                        <Label className="text-xs text-slate-400 mb-1">שדה במערכת</Label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Select 
                                    value={mapping[header] || "ignore"} 
                                    onValueChange={(val) => handleMapChange(header, val)}
                                >
                                    <SelectTrigger className={`${isMapped(header) ? 'border-green-200 bg-green-50 text-green-800' : ''}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ignore" className="text-slate-400">-- התעלם מעמודה זו --</SelectItem>
                                        {CRM_FIELDS.map(field => (
                                            <SelectItem 
                                            key={field.key} 
                                            value={field.key} 
                                            // Allow 'notes' to be selected multiple times, disable others if unique
                                            disabled={field.key !== 'notes' && Object.values(mapping).includes(field.key) && mapping[header] !== field.key}
                                            >
                                                {field.label} {field.required && '*'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* Custom Label Input for Notes */}
                            {mapping[header] === 'notes' && (
                                <div className="flex-1">
                                    <Input 
                                        placeholder="שם השדה בהערות"
                                        value={customLabels[header] || header}
                                        onChange={(e) => setCustomLabels({...customLabels, [header]: e.target.value})}
                                        className="h-10 border-orange-200 bg-orange-50 text-orange-800 placeholder:text-orange-300"
                                        title="השם שיופיע בתוך שדה ההערות"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה
        </Button>
        <Button 
            onClick={() => onNext(mapping, customLabels)} 
            disabled={!canProceed}
            className={canProceed ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
            המשך לאימות
            <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </div>
  );
}

function FileSpreadsheet({ className }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13h2" /><path d="M8 17h2" /><path d="M14 13h2" /><path d="M14 17h2" />
        </svg>
    )
}