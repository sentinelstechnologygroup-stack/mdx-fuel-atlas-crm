import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Loader2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSettings } from '@/components/context/SettingsContext';

export default function CustomFieldSettings() {
    const { theme } = useSettings();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const queryClient = useQueryClient();

    const { data: fields, isLoading } = useQuery({
        queryKey: ['custom_fields'],
        queryFn: () => base44.entities.CustomField.list(),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.CustomField.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['custom_fields'])
    });

    const handleEdit = (field) => {
        setEditingField(field || {
            name: "",
            label: "",
            type: "text",
            entity_type: "Lead",
            options: []
        });
        setIsEditOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Custom Fields</CardTitle>
                        <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Add extra data fields to Leads and Opportunities</CardDescription>
                    </div>
                    <Button onClick={() => handleEdit(null)} className="bg-slate-900 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        New Field
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Label</TableHead>
                                    <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>System ID</TableHead>
                                    <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Type</TableHead>
                                    <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Belongs To</TableHead>
                                    <TableHead className="text-right w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : fields.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                            No custom fields defined
                                        </TableCell>
                                    </TableRow>
                                ) : fields.map((field) => (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium">{field.label}</TableCell>
                                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{field.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{field.type}</Badge>
                                        </TableCell>
                                        <TableCell>{field.entity_type === 'Lead' ? 'Leads' : 'Opportunities'}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(field)}>
                                                    <Edit2 className="w-4 h-4 text-slate-500" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="hover:bg-red-50 hover:text-red-600"
                                                    onClick={() => {
                                                        if(confirm('Delete this field? Existing data will not be deleted but field will be hidden.')) {
                                                            deleteMutation.mutate(field.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CustomFieldDialog 
                open={isEditOpen} 
                onOpenChange={setIsEditOpen} 
                field={editingField}
                onSuccess={() => queryClient.invalidateQueries(['custom_fields'])}
            />
        </div>
    );
}

function CustomFieldDialog({ open, onOpenChange, field, onSuccess }) {
    const [formData, setFormData] = useState(field);
    const [optionsText, setOptionsText] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (field) {
            setFormData(field);
            setOptionsText(field.options ? field.options.join('\n') : "");
        }
    }, [field]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const dataToSave = {
                ...formData,
                // Simple slugify for name if new
                name: field?.id ? formData.name : formData.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                options: formData.type === 'select' ? optionsText.split('\n').filter(o => o.trim()) : []
            };

            if (field.id) {
                await base44.entities.CustomField.update(field.id, dataToSave);
            } else {
                await base44.entities.CustomField.create(dataToSave);
            }

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!formData) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{field?.id ? 'Edit Field' : 'Create New Field'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Label Name</Label>
                            <Input 
                                required 
                                value={formData.label}
                                onChange={(e) => setFormData({...formData, label: e.target.value})}
                                placeholder="e.g. Favorite Color"
                                className="dark:bg-slate-800 dark:border-slate-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Belongs To</Label>
                            <Select 
                                value={formData.entity_type} 
                                onValueChange={(val) => setFormData({...formData, entity_type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Lead">Leads</SelectItem>
                                    <SelectItem value="Opportunity">Opportunities</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Field Type</Label>
                        <Select 
                            value={formData.type} 
                            onValueChange={(val) => setFormData({...formData, type: val})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                                <SelectItem value="select">Select</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.type === 'select' && (
                        <div className="space-y-2">
                            <Label>Options (one per line)</Label>
                            <textarea 
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] dark:bg-slate-800 dark:border-slate-700"
                                value={optionsText}
                                onChange={(e) => setOptionsText(e.target.value)}
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading} className="bg-slate-900">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}