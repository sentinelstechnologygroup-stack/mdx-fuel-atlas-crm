import { useState, useMemo } from 'react';
import { atlas } from "@/api/atlasClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, ArrowRight, Loader2, RefreshCw, Tag, X } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useSettings } from "@/components/context/SettingsContext";

const STEPS = [
    { id: 1, label: 'Upload File' },
    { id: 2, label: 'Review and Tag' },
    { id: 3, label: 'Import' }
];

export default function ImportLeadsPage() {
  const { theme } = useSettings();
  const [step, setStep] = useState(1);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ valid: 0, invalid: 0 });
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Tag management
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const navigate = useNavigate();

  // Load existing tags from the system
  const { data: existingLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => atlas.entities.Lead.list(),
  });

  // Build a unique list of existing tags
  const suggestedTags = useMemo(() => {
      const allTags = existingLeads.flatMap(l => l.tags || []);
      return [...new Set(allTags)].filter(t => !selectedTags.includes(t));
  }, [existingLeads, selectedTags]);

  // Add a tag
  const addTag = (tagToAdd) => {
      const tag = tagToAdd.trim();
      if (tag && !selectedTags.includes(tag)) {
          setSelectedTags([...selectedTags, tag]);
      }
      setTagInput("");
  };

  // Remove a tag
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
            const fullName =
              row['Full Name'] ||
              row['full_name'] ||
              row['Name'] ||
              row['name'];

            const companyName =
              row['Company Name'] ||
              row['company_name'] ||
              row['Company'] ||
              row['company'] ||
              row['Business Name'] ||
              row['business_name'];

            const phone =
              row['Phone'] ||
              row['Phone Number'] ||
              row['phone'] ||
              row['phone_number'] ||
              row['Mobile'] ||
              row['mobile'];

            const email =
              row['Email'] ||
              row['Email Address'] ||
              row['email'];

            const city =
              row['City'] ||
              row['city'];

            const gallonsInput =
              row['Estimated Monthly Gallons'] ||
              row['Monthly Gallons'] ||
              row['estimated_monthly_gallons'] ||
              row['monthly_gallons'] ||
              row['Fuel Volume'] ||
              row['fuel_volume'];

            const notes =
              row['Notes'] ||
              row['notes'] ||
              row['Comments'] ||
              row['comments'];

            const status =
              row['Lead Status'] ||
              row['lead_status'] ||
              row['Status'] ||
              row['status'] ||
              'New';

            const normalizedGallons =
              gallonsInput === undefined ||
              gallonsInput === null ||
              gallonsInput === ''
                ? null
                : Number(
                    String(gallonsInput)
                      .replace(/[^0-9.]/g, '')
                  );

            const estimatedMonthlyGallons =
              Number.isFinite(normalizedGallons)
                ? normalizedGallons
                : null;

            const isValid =
              Boolean(
                fullName ||
                companyName ||
                phone
              );

            if (isValid) {
              validCount += 1;
            } else {
              invalidCount += 1;
            }

            return {
                id: index,
                full_name:
                  fullName ||
                  companyName ||
                  'Unknown Lead',
                company_name: companyName || '',
                phone_number: phone || '',
                email: email || '',
                city: city || '',
                estimated_monthly_gallons:
                  estimatedMonthlyGallons,
                notes: notes || '',
                lead_status: status,
                isValid,
                errors: isValid
                  ? ''
                  : 'Missing name, company, and phone number'
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
                  const { isValid: _isValid, errors: _errors, id: _id, ...leadData } = row;
                  // Add selected tags to every lead
                  const finalLead = {
                      ...leadData,
                      tags: selectedTags // Send selected tags to the server
                  };
                  return atlas.entities.Lead.create(finalLead);
              }));

              completed += batch.length;
              setImportProgress(Math.round((completed / total) * 100));

          } catch (error) {
              console.error(`Batch failed at index ${i}`, error);
          }
      }

      setIsImporting(false);
      setTimeout(() => {
          alert(`Import complete. ${completed} leads were imported successfully with tags: ${selectedTags.join(', ')}`);
          navigate('/Leads');
      }, 500);
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-8 pb-20 pt-10 font-sans ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>

        <div className="relative text-center space-y-2">
            <Button
                variant="ghost"
                onClick={() => navigate('/Leads')}
                className={`absolute top-0 right-0 ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <ArrowRight className="w-5 h-5 ml-2" />
                Back
            </Button>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Import Leads</h1>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Upload a CSV file to import leads in bulk.</p>
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
                <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Drag a CSV file here</h3>
                <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>CSV files only</p>
                <Button variant="outline" className={`mt-6 pointer-events-none ${
                    theme === 'dark'
                        ? 'border-slate-600 text-slate-300 bg-slate-800'
                        : 'border-slate-200 text-slate-600 hover:bg-white hover:text-red-700'
                }`}>Choose File</Button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                <div className="grid grid-cols-2 gap-4">
                    <Card className={theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 shadow-sm' : 'bg-green-50 border-green-100 shadow-sm'}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`} />
                            <div>
                                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-300' : 'text-green-800'}`}>Valid Records</p>
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
                                <p className={`text-sm font-medium ${summary.invalid > 0 ? (theme === 'dark' ? 'text-red-300' : 'text-red-800') : 'text-slate-500'}`}>Errors / Missing Data</p>
                                <p className={`text-2xl font-bold ${summary.invalid > 0 ? (theme === 'dark' ? 'text-red-400' : 'text-red-700') : 'text-slate-400'}`}>{summary.invalid}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tagging controls */}
                <Card className={`shadow-sm overflow-visible ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <CardContent className="p-6">
                        <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                            <Tag className="w-5 h-5 text-red-600" />
                            Add Tags to This Import
                        </h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter a tag and press Enter, such as January Import or High Priority"
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
                                <Button onClick={() => addTag(tagInput)} variant="outline" className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:text-red-700'}>Add</Button>
                            </div>

                            {/* Selected tags */}
                            <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
                                {selectedTags.length === 0 && <span className="text-sm text-slate-400 italic">No tags selected</span>}
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

                            {/* Existing tag suggestions */}
                            {suggestedTags.length > 0 && (
                                <div className={`mt-2 pt-2 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <p className="text-xs text-slate-500 mb-2">Existing tags:</p>
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
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Preview — First 50 Records</h3>
                        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-slate-500 hover:text-red-600">
                            <RefreshCw className="w-4 h-4 ml-1" /> Choose Different File
                        </Button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                            <TableHeader className={`sticky top-0 shadow-sm z-10 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                <TableRow className={theme === 'dark' ? 'border-slate-700' : ''}>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Status</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Full Name</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Phone</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>City</TableHead>
                                    <TableHead className={`text-right font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Monthly Gallons</TableHead>
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
                                                <Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-0' : 'bg-green-100 text-green-700 border-0'}>Valid</Badge>
                                            ) : (
                                                <Badge variant="destructive" className={theme === 'dark' ? 'bg-red-900/30 text-red-400 border-0' : 'bg-red-100 text-red-700 border-0'}>
                                                    {row.errors}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{row.full_name}</TableCell>
                                        <TableCell className={`font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{row.phone_number}</TableCell>
                                        <TableCell className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{row.city}</TableCell>
                                        <TableCell className="text-slate-500">
                                            {row.estimated_monthly_gallons
                                              ? `${Number(
                                                  row.estimated_monthly_gallons
                                                ).toLocaleString('en-US')} gal`
                                              : '-'}
                                        </TableCell>
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
                                    <Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-0' : 'bg-green-100 text-green-700 border-0'}>Valid</Badge>
                                ) : (
                                    <Badge variant="destructive" className={theme === 'dark' ? 'bg-red-900/30 text-red-400 border-0' : 'bg-red-100 text-red-700 border-0'}>
                                        {row.errors}
                                    </Badge>
                                )}
                            </div>

                            <div className={`p-3 rounded-lg border space-y-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 text-sm">Phone:</span>
                                    <span className={`font-mono font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{row.phone_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 text-sm">Monthly Gallons:</span>
                                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                                        {row.estimated_monthly_gallons
                                          ? `${Number(
                                              row.estimated_monthly_gallons
                                            ).toLocaleString('en-US')} gal`
                                          : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-4">
                    <Button variant="ghost" onClick={() => setStep(1)} className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500'}>Back</Button>

                    <div className="flex gap-4 items-center">
                        {isImporting && (
                            <div className="flex flex-col items-end gap-1 min-w-[200px]">
                                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{importProgress}% Complete</span>
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
                                <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> Importing Data...</>
                            ) : (
                                <><ArrowRight className="w-5 h-5 ml-2" /> Import {summary.valid} Leads</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
