import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Upload, FileImage, Type, Camera, CheckCircle2, Edit3, ArrowRight, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/components/context/SettingsContext";

export default function AiLeadImport({ open, onOpenChange, onLeadCreated }) {
  const { theme } = useSettings();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState("text"); // text or image
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  const processTextInput = async () => {
    if (!input.trim() && !selectedFile) return;

    setIsProcessing(true);
    try {
      let textToAnalyze = input;

      // אם זו תמונה, נחלץ תחילה את הטקסט
      if (mode === "image" && selectedFile) {
        // העלאת התמונה
        const uploadResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
        const fileUrl = uploadResult.file_url;

        // חילוץ מידע ישירות מהתמונה עם AI Vision
        const visionResult = await base44.integrations.Core.InvokeLLM({
          prompt: `CRM/Salesforce Screenshot Analysis (Phone photo):
Please scan the image carefully and extract lead details. The image might be a screenshot of a CRM system.

Extract accurately:
1. Full Name - Look at the top of the card or name field.
2. Phone - In local format.
3. Email.
4. Customer Need - Look for description of what the client wants, loan purpose, or reason for contact.
5. Notes - Summarize *all* other data visible on screen (address, ID, age, marital status, financial status, previous system notes, etc.) into one detailed text.

Notes:
- If blurry, try to decipher by context.
- If multiple phones, take the main one.
- Do not invent information.`,
          file_urls: [fileUrl],
          response_json_schema: {
            type: "object",
            properties: {
              full_name: { type: "string" },
              phone_number: { type: "string" },
              email: { type: "string" },
              customer_need: { type: "string", description: "The main need or reason for contact" },
              additional_info: { type: "string", description: "Summary of all other visible fields and data" }
            }
          }
        });

        // הכנת נתונים לתצוגה מקדימה
        const combinedNotes = [
          visionResult.customer_need ? `Customer Need: ${visionResult.customer_need}` : null,
          visionResult.additional_info
        ].filter(Boolean).join("\n\n---\nAdditional Scan Info:\n");

        const leadData = {
          full_name: visionResult.full_name,
          phone_number: visionResult.phone_number,
          email: visionResult.email,
          notes: combinedNotes,
          lead_status: "New",
          source_year: new Date().getFullYear().toString(),
          last_contact_date: new Date().toISOString().split('T')[0]
        };

        setExtractedData(leadData);
        setPreviewMode(true);
        setIsProcessing(false);
        return; // Skip text analysis
      }

      // ניתוח הטקסט ע"י AI
      const leadSchema = {
        type: "object",
        properties: {
          full_name: { type: "string" },
          phone_number: { type: "string" },
          email: { type: "string" },
          customer_need: { type: "string" },
          additional_info: { type: "string" }
        },
        required: ["full_name", "phone_number"]
      };

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Lead Text Analysis (Copy-Paste or Free Text):
Extract the following details from the text:
1. Full Name
2. Phone
3. Email
4. Customer Need (What does the client want?)
5. All other info - summarize neatly into additional_info field.

Here is the text to analyze:
${textToAnalyze}`,
        response_json_schema: leadSchema
      });

      const combinedNotes = [
        aiResult.customer_need ? `Customer Need: ${aiResult.customer_need}` : null,
        aiResult.additional_info
      ].filter(Boolean).join("\n\n---\nAdditional Info:\n");

      // הכנת נתונים לתצוגה מקדימה
      const leadData = {
        full_name: aiResult.full_name,
        phone_number: aiResult.phone_number,
        email: aiResult.email,
        notes: combinedNotes,
        lead_status: "New",
        source_year: new Date().getFullYear().toString(),
        last_contact_date: new Date().toISOString().split('T')[0]
      };

      setExtractedData(leadData);
      setPreviewMode(true);
      setIsProcessing(false);

    } catch (error) {
      console.error("Error processing lead:", error);
      toast.error("Error processing data", {
        description: error.message,
        duration: 5000
      });
      setIsProcessing(false);
    }
  };

  const handleSaveLead = () => {
    onLeadCreated(extractedData);
    toast.success("Lead imported successfully!", {
      description: `${extractedData.full_name} • ${extractedData.phone_number}`,
      duration: 3000
    });
    
    // איפוס הטופס וסגירה
    setInput("");
    setSelectedFile(null);
    setPreviewMode(false);
    setExtractedData(null);
    onOpenChange(false);
  };

  const handleEditPreview = () => {
    setPreviewMode(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!isProcessing && !previewMode) {
        onOpenChange(newOpen);
        setInput("");
        setSelectedFile(null);
        setExtractedData(null);
      }
    }}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white'}`} dir="ltr" onPointerDownOutside={(e) => {
        if (isProcessing) {
          e.preventDefault();
        }
      }} onEscapeKeyDown={(e) => {
        if (isProcessing) {
          e.preventDefault();
        }
      }}>
        <AnimatePresence mode="wait">
          {!previewMode ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <div className="flex justify-between items-start">
                    <DialogTitle className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        <Sparkles className="w-6 h-6 text-purple-600" />
                        Smart AI Lead Import
                    </DialogTitle>

                </div>
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Paste free text or upload an image, and AI will automatically extract the details
                </p>
              </DialogHeader>

        <Tabs value={mode} onValueChange={setMode} className="w-full">
          <TabsList className={`grid w-full grid-cols-2 mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <TabsTrigger value="text" className={`flex items-center gap-2 ${theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400' : ''}`}>
              <Type className="w-4 h-4" />
              Free Text
            </TabsTrigger>
            <TabsTrigger value="image" className={`flex items-center gap-2 ${theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400' : ''}`}>
              <FileImage className="w-4 h-4" />
              Image Scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div>
              <label className={`text-sm font-medium mb-2 block ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Paste lead details text here
              </label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Example:
David Cohen, Age 68, lives in Tel Aviv
Phone: 050-1234567
Married, has 3 children
Has an apartment worth about 3 million
Has a mortgage of 500,000 NIS
Interested in a reverse mortgage to help the children"
                className={`h-64 resize-none font-mono text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500' : 'bg-white border-slate-200 placeholder:text-slate-400 focus:border-purple-500'}`}
                disabled={isProcessing}
              />
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* כפתור צילום ישיר */}
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${theme === 'dark' ? 'border-slate-700 hover:border-purple-500/50 hover:bg-slate-800' : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/10'}`}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="camera-capture"
                  disabled={isProcessing}
                />
                <label htmlFor="camera-capture" className="cursor-pointer">
                  <Camera className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Take Photo</p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Open Camera</p>
                </label>
              </div>

              {/* כפתור העלאת קובץ */}
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${theme === 'dark' ? 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800' : 'border-slate-200 hover:border-purple-300 hover:bg-blue-50/10'}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto mb-3 text-blue-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Upload Image</p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Choose from Gallery</p>
                </label>
              </div>
            </div>

            {selectedFile && (
              <div className={`border rounded-lg p-4 ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-800' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <img 
                      src={URL.createObjectURL(selectedFile)} 
                      alt="preview" 
                      className={`w-20 h-20 rounded-lg object-cover border-2 ${theme === 'dark' ? 'border-emerald-700' : 'border-green-300'}`}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-green-800'}`}>✓ {selectedFile.name}</p>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`}>Image ready for AI Vision scan</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedFile(null)}
                      className={`text-xs mt-2 h-7 ${theme === 'dark' ? 'text-red-400 hover:bg-red-950/30' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      Remove Image
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`border rounded-xl p-6 text-center shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-blue-900' : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200'}`}
          >
            <Loader2 className={`w-12 h-12 mx-auto mb-3 animate-spin ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            <p className={`text-base font-bold mb-2 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>Processing data...</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
              {mode === "image" ? "🔍 AI Vision is scanning the image and extracting details" : "🤖 AI is analyzing the text"}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </motion.div>
        )}

        <div className={`flex gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-800' : ''}`}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className={`flex-1 ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : ''}`}
          >
            Cancel
          </Button>
          <Button
            onClick={processTextInput}
            disabled={isProcessing || (!input.trim() && !selectedFile)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 ml-2" />
                Import Lead
              </>
            )}
          </Button>
        </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <DialogTitle className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                Review Identified Details
              </DialogTitle>
              <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                AI extracted the following information - edit if needed and save
              </p>
            </DialogHeader>

            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Full Name *</label>
                  <Input
                    value={extractedData?.full_name || ""}
                    onChange={(e) => setExtractedData({...extractedData, full_name: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Phone *</label>
                  <Input
                    value={extractedData?.phone_number || ""}
                    onChange={(e) => setExtractedData({...extractedData, phone_number: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
                  <Input
                    value={extractedData?.email || ""}
                    onChange={(e) => setExtractedData({...extractedData, email: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>City</label>
                  <Input
                    value={extractedData?.city || ""}
                    onChange={(e) => setExtractedData({...extractedData, city: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Age</label>
                  <Input
                    type="number"
                    value={extractedData?.age || ""}
                    onChange={(e) => setExtractedData({...extractedData, age: parseInt(e.target.value)})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Marital Status</label>
                  <Input
                    value={extractedData?.marital_status || ""}
                    onChange={(e) => setExtractedData({...extractedData, marital_status: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                  />
                </div>
              </div>

              {extractedData?.notes && (
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Notes</label>
                  <Textarea
                    value={extractedData.notes}
                    onChange={(e) => setExtractedData({...extractedData, notes: e.target.value})}
                    className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-purple-500' : 'border-purple-200 focus:border-purple-500'}`}
                    rows={3}
                  />
                </div>
              )}

              <div className={`flex gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-800' : ''}`}>
                <Button
                  variant="outline"
                  onClick={handleEditPreview}
                  className={`flex-1 ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : ''}`}
                >
                  <Edit3 className="w-4 h-4 ml-2" />
                  Back to Edit
                </Button>
                <Button
                  onClick={handleSaveLead}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  Save Lead
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
        </DialogContent>
        </Dialog>
        );
        }