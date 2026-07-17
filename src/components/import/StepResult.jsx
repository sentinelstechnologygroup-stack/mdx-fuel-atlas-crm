import React from 'react';
import { CheckCircle2, AlertTriangle, Download, ArrowRight, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StepResult({ results, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2 animate-in zoom-in duration-500">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">הייבוא הושלם!</h2>
        <p className="text-slate-500 text-lg">
            הנתונים עובדו ונקלטו במערכת בהצלחה.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-8">
        <div className="bg-green-50 border border-green-100 p-6 rounded-xl">
            <p className="text-sm text-green-600 font-medium mb-1">נקלטו בהצלחה</p>
            <p className="text-4xl font-bold text-green-700">{results.success}</p>
        </div>
        <div className="bg-red-50 border border-red-100 p-6 rounded-xl">
            <p className="text-sm text-red-600 font-medium mb-1">נכשלו / דולגו</p>
            <p className="text-4xl font-bold text-red-700">{results.failed}</p>
        </div>
      </div>

      {results.failed > 0 && (
        <Button variant="outline" className="mt-4 text-red-600 border-red-200 hover:bg-red-50">
            <Download className="w-4 h-4 ml-2" />
            הורד דוח שגיאות (CSV)
        </Button>
      )}

      <div className="flex gap-4 mt-8">
        <Button variant="outline" onClick={onReset}>
            ייבא קובץ נוסף
        </Button>
        <Link to={createPageUrl('Leads')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
                <Home className="w-4 h-4 ml-2" />
                עבור לרשימת הלידים
            </Button>
        </Link>
      </div>
    </div>
  );
}