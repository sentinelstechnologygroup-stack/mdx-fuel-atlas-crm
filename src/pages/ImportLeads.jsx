import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, ArrowRight, Loader2, RefreshCw, Tag, X, ArrowLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useSettings } from "@/components/context/SettingsContext";

const STEPS = [
    { id: 1, label: 'העלאת קובץ' },
    { id: 2, label: 'בדיקה ותיוג' },
    { id: 3, label: 'ייבוא' }
];

export default function ImportLeadsPage() {
  const { theme } = useSettings();
  const [step, setStep] = useState(1);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ valid: 0, invalid: 0 });
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  
  // ניהול תגיות
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  
  const navigate = useNavigate();

  // שליפת תגיות קיימות מהמערכת (סנכרון חכם)
  const { data: existingLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
  });

  // חישוב רשימת תגיות ייחודיות קיימות
  const suggestedTags = useMemo(() => {
      const allTags = existingLeads.flatMap(l => l.tags || []);
      return [...new Set(allTags)].filter(t => !selectedTags.includes(t));
  }, [existingLeads, selectedTags]);

  // הוספת תגית
  const addTag = (tagToAdd) => {
      const tag = tagToAdd.trim();
      if (tag && !selectedTags.includes(tag)) {
          setSelectedTags([...selectedTags, tag]);
      }
      setTagInput("");
  };

  // הסרת תגית
  const removeTag = (tagToRemove) => {
      setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const parseCSV = (text) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map((line, index) => {
      if (!line.trim()) return null;
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      return { ...row, _originalIndex: index };
    }).filter(row => row !== null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const jsonData = parseCSV(text);
        
        let validCount = 0;
        let invalidCount = 0;

        const mappedData = jsonData.map((row, index) => {
            // זיהוי שדות (כולל שדות פיננסיים והערות)
            const fullName = row['Name'] || row['name'] || row['שם'] || row['שם מלא'] || row['שם לקוח'] || row['לקוח'] || row['Full Name'];
            const phone = row['Phone'] || row['phone'] || row['טלפון'] || row['נייד'] || row['סלולרי'] || row['Mobile'];
            const city = row['City'] || row['city'] || row['עיר'] || row['כתובת'];
            const year = row['Year'] || row['year'] || row['שנה'] || new Date().getFullYear().toString();
            
            // שדות נוספים
            const age = row['Age'] || row['age'] || row['גיל'];
            const email = row['Email'] || row['email'] || row['אימייל'] || row['מייל'];
            const notes = row['Notes'] || row['notes'] || row['הערות'] || row['סיכום'];
            const marital = row['Marital Status'] || row['marital'] || row['מצב משפחתי']; // צריך להיות באנגלית: Married, Single, etc.
            const propertyVal = row['Estimated Value'] || row['property'] || row['שווי נכס'];
            const mortgageBal = row['Mortgage Balance'] || row['mortgage'] || row['יתרת משכנתא'];
            const status = row['Status'] || row['status'] || row['סטטוס'] || 'New';
  
            const isValid = !!(fullName || phone);

            if (isValid) validCount++; else invalidCount++;
  
            return {
                id: index,
                full_name: fullName || 'לא ידוע',
                phone_number: phone || '',
                city: city || '',
                age: age || '',
                email: email || '',
                notes: notes || '',
                marital_status: marital || '',
                estimated_property_value: propertyVal || '',
                existing_mortgage_balance: mortgageBal || '',
                lead_status: status,
                source_year: year,
                isValid,
                errors: !isValid ? 'שורה ריקה או חסרה' : ''
            };
        });

        setData(mappedData);
        setSummary({ valid: validCount, invalid: invalidCount });
        setStep(2);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
      setIsImporting(true);
      const validRows = data.filter(r => r.isValid);
      const total = validRows.length;
      const BATCH_SIZE = 50; 
      let completed = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          
          try {
              await Promise.all(batch.map(row => {
                  const { isValid, errors, id, ...leadData } = row;
                  // הוספת התגיות שנבחרו לכל ליד
                  const finalLead = {
                      ...leadData,
                      tags: selectedTags // שליחת מערך התגיות לשרת
                  };
                  return base44.entities.Lead.create(finalLead);
              }));
              
              completed += batch.length;
              setImportProgress(Math.round((completed / total) * 100));
              
          } catch (error) {
              console.error(`Batch failed at index ${i}`, error);
          }
      }

      setIsImporting(false);
      setTimeout(() => {
          alert(`תהליך הסתיים! ${completed} לידים יובאו בהצלחה עם התגיות: ${selectedTags.join(', ')}`);
          navigate('/Leads');
      }, 500);
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-8 pb-20 pt-10 font-sans ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} dir="rtl">
        
        <div className="relative text-center space-y-2">
            <Button 
                variant="ghost" 
                onClick={() => navigate('/Leads')} 
                className={`absolute top-0 right-0 ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <ArrowRight className="w-5 h-5 ml-2" />
                חזרה
            </Button>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>ייבוא לידים</h1>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>העלה קובץ CSV כדי להזין נתונים בצורה מרוכזת</p>
        </div>

        <div className="flex justify-center items-center gap-4 mb-8">
            {STEPS.map((s, i) => {
                const isActive = step === s.id;
                const isCompleted = step > s.id;
                
                let containerClass = theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400';
                let circleClass = theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500';
                
                if (isActive) {
                    containerClass = theme === 'dark' ? 'bg-red-900/20 text-red-400 ring-1 ring-red-800' : 'bg-red-50 text-red-700 ring-1 ring-red-200';
                    circleClass = 'bg-red-600 text-white';
                } else if (isCompleted) {
                    containerClass = theme === 'dark' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-green-50 text-green-600';
                    circleClass = 'bg-emerald-600 text-white';
                }

                return (
                    <div key={s.id} className="flex items-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${containerClass}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${circleClass}`}>
                                {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : s.id}
                            </div>
                            {s.label}
                        </div>
                        {i < STEPS.length - 1 && <div className={`w-8 h-[2px] mx-2 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />}
                    </div>
                );
            })}
        </div>

        {step === 1 && (
            <div className={`border-2 border-dashed rounded-3xl p-24 text-center transition-all relative shadow-sm ${
                theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 hover:border-red-500/50 hover:bg-slate-800/80' 
                    : 'bg-white border-slate-300 hover:border-red-400 hover:bg-slate-50'
            }`}>
                <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-red-50'
                }`}>
                    <Upload className={`w-10 h-10 ${theme === 'dark' ? 'text-red-500' : 'text-red-600'}`} />
                </div>
                <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>גרור קובץ לכאן</h3>
                <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>תומך בקבצי CSV בלבד</p>
                <Button variant="outline" className={`mt-6 pointer-events-none ${
                    theme === 'dark' 
                        ? 'border-slate-600 text-slate-300 bg-slate-800' 
                        : 'border-slate-200 text-slate-600 hover:bg-white hover:text-red-700'
                }`}>בחר קובץ מהמחשב</Button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                <div className="grid grid-cols-2 gap-4">
                    <Card className={theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 shadow-sm' : 'bg-green-50 border-green-100 shadow-sm'}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`} />
                            <div>
                                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-300' : 'text-green-800'}`}>רשומות תקינות</p>
                                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-green-700'}`}>{summary.valid}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={`shadow-sm ${
                        summary.invalid > 0 
                            ? theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-100'
                            : theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className={`w-8 h-8 ${summary.invalid > 0 ? (theme === 'dark' ? 'text-red-500' : 'text-red-600') : 'text-slate-400'}`} />
                            <div>
                                <p className={`text-sm font-medium ${summary.invalid > 0 ? (theme === 'dark' ? 'text-red-300' : 'text-red-800') : 'text-slate-500'}`}>שגיאות / חסרים</p>
                                <p className={`text-2xl font-bold ${summary.invalid > 0 ? (theme === 'dark' ? 'text-red-400' : 'text-red-700') : 'text-slate-400'}`}>{summary.invalid}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* --- אזור תיוג חכם --- */}
                <Card className={`shadow-sm overflow-visible ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <CardContent className="p-6">
                        <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                            <Tag className="w-5 h-5 text-red-600" />
                            הוסף תגיות לקבוצה זו
                        </h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="הקלד תגית ולחץ Enter (למשל: ייבוא ינואר, ליד חם)" 
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTag(tagInput);
                                        }
                                    }}
                                    className={`max-w-md ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'border-slate-300 focus:border-red-500 focus:ring-red-500'}`}
                                />
                                <Button onClick={() => addTag(tagInput)} variant="outline" className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:text-red-700'}>הוסף</Button>
                            </div>
                            
                            {/* תצוגת התגיות שנבחרו */}
                            <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
                                {selectedTags.length === 0 && <span className="text-sm text-slate-400 italic">לא נבחרו תגיות</span>}
                                {selectedTags.map(tag => (
                                    <Badge key={tag} className={`pl-1 pr-3 py-1 flex items-center gap-1 text-sm font-medium ${
                                        theme === 'dark' ? 'bg-red-900/30 text-red-300 border-red-800' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                    }`}>
                                        <X 
                                            className="w-3 h-3 cursor-pointer hover:opacity-70 rounded-full" 
                                            onClick={() => removeTag(tag)}
                                        />
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            {/* הצעות לתגיות קיימות */}
                            {suggestedTags.length > 0 && (
                                <div className={`mt-2 pt-2 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <p className="text-xs text-slate-500 mb-2">תגיות קיימות במערכת:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestedTags.map(tag => (
                                            <button 
                                                key={tag} 
                                                onClick={() => addTag(tag)}
                                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                                    theme === 'dark' ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                + {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Desktop View */}
                <div className={`hidden md:block rounded-xl border shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>תצוגה מקדימה (50 רשומות ראשונות)</h3>
                        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-slate-500 hover:text-red-600">
                            <RefreshCw className="w-4 h-4 ml-1" /> החלף קובץ
                        </Button>
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                            <TableHeader className={`sticky top-0 shadow-sm z-10 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                <TableRow className={theme === 'dark' ? 'border-slate-700' : ''}>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>סטטוס</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>שם מלא</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>טלפון</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>עיר</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>שנה</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.slice(0, 50).map((row, i) => (
                                    <TableRow key={i} className={`
                                        ${theme === 'dark' ? 'hover:bg-slate-700/50 border-slate-700' : 'hover:bg-slate-50'}
                                        ${!row.isValid 
                                            ? (theme === 'dark' ? 'bg-red-900/10' : 'bg-red-50/30') 
                                            : ''}
                                    `}>
                                        <TableCell>
                                            {row.isValid ? (
                                                <Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-0' : 'bg-green-100 text-green-700 border-0'}>תקין</Badge>
                                            ) : (
                                                <Badge variant="destructive" className={theme === 'dark' ? 'bg-red-900/30 text-red-400 border-0' : 'bg-red-100 text-red-700 border-0'}>
                                                    {row.errors}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{row.full_name}</TableCell>
                                        <TableCell className={`font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{row.phone_number}</TableCell>
                                        <TableCell className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{row.city}</TableCell>
                                        <TableCell className="text-slate-500">{row.source_year}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                    {data.slice(0, 50).map((row, i) => (
                        <div key={i} className={`p-4 rounded-xl shadow-sm border flex flex-col gap-3 ${
                            theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        } ${!row.isValid ? (theme === 'dark' ? 'border-red-900/50 bg-red-900/10' : 'border-red-200 bg-red-50/30') : ''}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{row.full_name}</div>
                                    <div className="text-xs text-slate-500">{row.city}</div>
                                </div>
                                {row.isValid ? (
                                    <Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-0' : 'bg-green-100 text-green-700 border-0'}>תקין</Badge>
                                ) : (
                                    <Badge variant="destructive" className={theme === 'dark' ? 'bg-red-900/30 text-red-400 border-0' : 'bg-red-100 text-red-700 border-0'}>
                                        {row.errors}
                                    </Badge>
                                )}
                            </div>
                            
                            <div className={`p-3 rounded-lg border space-y-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 text-sm">טלפון:</span>
                                    <span className={`font-mono font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{row.phone_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 text-sm">שנה:</span>
                                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{row.source_year}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-4">
                    <Button variant="ghost" onClick={() => setStep(1)} className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500'}>חזרה</Button>
                    
                    <div className="flex gap-4 items-center">
                        {isImporting && (
                            <div className="flex flex-col items-end gap-1 min-w-[200px]">
                                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{importProgress}% הושלם</span>
                                <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                    <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                                </div>
                            </div>
                        )}
                        
                        <Button 
                            onClick={handleImport} 
                            disabled={isImporting || summary.valid === 0} 
                            className={`px-8 py-6 text-lg rounded-xl transition-all hover:scale-105 text-white shadow-lg ${
                                theme === 'dark' 
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-900/40' 
                                    : 'bg-red-700 hover:bg-red-800 shadow-red-900/20'
                            }`}
                        >
                            {isImporting ? (
                                <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> מייבא נתונים...</>
                            ) : (
                                <><ArrowRight className="w-5 h-5 ml-2" /> ייבא {summary.valid} לידים</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}