import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ArrowRight, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import StepUpload from "./StepUpload";
import StepMapping from "./StepMapping";
import StepPreview from "./StepPreview";
import StepResult from "./StepResult";
import { base44 } from "@/api/base44Client";

export default function ImportWizard() {
  const [step, setStep] = useState(1);
  const [rawFile, setRawFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [customLabels, setCustomLabels] = useState({});
  const [importResults, setImportResults] = useState(null);

  const handleDataParsed = (data, headers, file) => {
    setParsedData(data);
    setFileHeaders(headers);
    setRawFile(file);
    setStep(2);
  };

  const handleMappingComplete = (newMapping, newCustomLabels) => {
    setMapping(newMapping);
    setCustomLabels(newCustomLabels || {});
    setStep(3);
  };

  const handleImportComplete = (results) => {
    setImportResults(results);
    setStep(4);
  };

  const resetWizard = () => {
    setStep(1);
    setRawFile(null);
    setParsedData([]);
    setFileHeaders([]);
    setMapping({});
    setImportResults(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8" dir="rtl">
      {/* Wizard Progress Header */}
      <div className="relative flex justify-between items-center mb-12 px-10">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
        <div 
            className="absolute top-1/2 right-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500" 
            style={{ width: `${((step - 1) / 3) * 100}%` }}
        />
        
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 bg-white px-2">
            <motion.div 
              initial={false}
              animate={{ 
                scale: step === s ? 1.1 : 1,
                backgroundColor: step >= s ? '#2563eb' : '#f1f5f9',
                borderColor: step >= s ? '#2563eb' : '#e2e8f0'
              }}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-colors
                ${step >= s ? 'text-white' : 'text-slate-400'}
              `}
            >
              {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
            </motion.div>
            <span className={`text-sm font-medium ${step >= s ? 'text-blue-600' : 'text-slate-400'}`}>
              {s === 1 && "העלאה"}
              {s === 2 && "מיפוי"}
              {s === 3 && "אימות"}
              {s === 4 && "סיום"}
            </span>
          </div>
        ))}
      </div>

      {/* Steps Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8 min-h-[500px] shadow-xl border-slate-100">
            {step === 1 && <StepUpload onDataParsed={handleDataParsed} />}
            {step === 2 && (
                <StepMapping 
                    headers={fileHeaders} 
                    onBack={() => setStep(1)}
                    onNext={handleMappingComplete}
                />
            )}
            {step === 3 && (
                <StepPreview 
                    data={parsedData} 
                    mapping={mapping}
                    customLabels={customLabels}
                    onBack={() => setStep(2)}
                    onImport={handleImportComplete}
                />
            )}
            {step === 4 && (
                <StepResult 
                    results={importResults} 
                    onReset={resetWizard}
                />
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}