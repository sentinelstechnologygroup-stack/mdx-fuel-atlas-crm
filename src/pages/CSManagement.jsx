import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { atlas } from "@/api/atlasClient";
import ClientDashboard from "@/components/cs/ClientDashboard";
import ClientList from "@/components/cs/ClientList";
import ClientDetails from "@/components/cs/ClientDetails";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/context/SettingsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CSManagementPage() {
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const [selectedClient, setSelectedClient] = useState(null);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [customerForm, setCustomerForm] = useState({
        company_name: "",
        full_name: "",
        phone_number: "",
        email: "",
        customer_status: "Prospect",
        assigned_salesperson: "",
        primary_fuel_type: "On-Road Diesel",
        estimated_monthly_gallons: "",
        delivery_type: "Scheduled",
        tank_rental: "No",
        number_of_tanks: "",
        credit_status: "Not Submitted",
        payment_terms: "",
        notes: ""
    });
    const queryClient = useQueryClient();

    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: () => atlas.entities.Client.list(),
        initialData: []
    });

    const createCustomer = useMutation({
        mutationFn: (data) => atlas.entities.Client.create({
            ...data,
            full_name: data.company_name || data.full_name,
            product_type: data.primary_fuel_type,
            customer_segment: data.customer_status,
            onboarding_status: "Not Started",
            health_score: 100,
            initial_amount: 0,
            contract_start_date: new Date().toISOString().split('T')[0],
            estimated_monthly_gallons: Number(data.estimated_monthly_gallons) || 0,
            number_of_tanks: Number(data.number_of_tanks) || 0
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['clients']);
            setShowCustomerForm(false);
            setCustomerForm({
                company_name: "",
                full_name: "",
                phone_number: "",
                email: "",
                customer_status: "Prospect",
                assigned_salesperson: "",
                primary_fuel_type: "On-Road Diesel",
                estimated_monthly_gallons: "",
                delivery_type: "Scheduled",
                tank_rental: "No",
                number_of_tanks: "",
                credit_status: "Not Submitted",
                payment_terms: "",
                notes: ""
            });
        }
    });

    const updateCustomerField = (field, value) => {
        setCustomerForm((current) => ({ ...current, [field]: value }));
    };

    const handleCreateCustomer = (event) => {
        event.preventDefault();
        createCustomer.mutate(customerForm);
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className={`min-h-screen p-6 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold">MDX Customer Accounts</h1>
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Active fuel customers, delivery programs, tanks, credit, and follow-ups.
                    </p>
                </div>
                <Button
                    onClick={() => setShowCustomerForm(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Customer
                </Button>
            </div>
            
            <ClientDashboard clients={clients} />
            
            <ClientList 
                clients={clients} 
                onSelectClient={setSelectedClient} 
            />

            <ClientDetails 
                client={selectedClient} 
                open={!!selectedClient} 
                onClose={() => setSelectedClient(null)} 
            />

            <Dialog open={showCustomerForm} onOpenChange={setShowCustomerForm}>
                <DialogContent className={`max-w-3xl ${isDark ? 'bg-slate-900 border-slate-700 text-white' : ''}`}>
                    <DialogHeader>
                        <DialogTitle>New MDX Customer Account</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateCustomer} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input required value={customerForm.company_name} onChange={(e) => updateCustomerField('company_name', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Primary Contact</Label>
                                <Input value={customerForm.full_name} onChange={(e) => updateCustomerField('full_name', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={customerForm.phone_number} onChange={(e) => updateCustomerField('phone_number', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={customerForm.email} onChange={(e) => updateCustomerField('email', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer Status</Label>
                                <Select value={customerForm.customer_status} onValueChange={(value) => updateCustomerField('customer_status', value)}>
                                    <SelectTrigger className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                                    <SelectContent className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                        <SelectItem value="Prospect">Prospect</SelectItem>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                        <SelectItem value="Closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Primary Fuel Type</Label>
                                <Select value={customerForm.primary_fuel_type} onValueChange={(value) => updateCustomerField('primary_fuel_type', value)}>
                                    <SelectTrigger className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                                    <SelectContent className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                        <SelectItem value="On-Road Diesel">On-Road Diesel</SelectItem>
                                        <SelectItem value="Off-Road Diesel">Off-Road Diesel</SelectItem>
                                        <SelectItem value="Gasoline">Gasoline</SelectItem>
                                        <SelectItem value="DEF">DEF</SelectItem>
                                        <SelectItem value="Lubricants">Lubricants</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Estimated Gallons / Month</Label>
                                <Input type="number" min="0" value={customerForm.estimated_monthly_gallons} onChange={(e) => updateCustomerField('estimated_monthly_gallons', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Type</Label>
                                <Select value={customerForm.delivery_type} onValueChange={(value) => updateCustomerField('delivery_type', value)}>
                                    <SelectTrigger className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                                    <SelectContent className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                                        <SelectItem value="Keep Full">Keep Full</SelectItem>
                                        <SelectItem value="Call In">Call In</SelectItem>
                                        <SelectItem value="Emergency">Emergency</SelectItem>
                                        <SelectItem value="On Demand">On Demand</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tank Rental?</Label>
                                <Select value={customerForm.tank_rental} onValueChange={(value) => updateCustomerField('tank_rental', value)}>
                                    <SelectTrigger className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                                    <SelectContent className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                        <SelectItem value="Yes">Yes</SelectItem>
                                        <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Number of Tanks</Label>
                                <Input type="number" min="0" value={customerForm.number_of_tanks} onChange={(e) => updateCustomerField('number_of_tanks', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                            <div className="space-y-2">
                                <Label>Credit Status</Label>
                                <Select value={customerForm.credit_status} onValueChange={(value) => updateCustomerField('credit_status', value)}>
                                    <SelectTrigger className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                                    <SelectContent className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                        <SelectItem value="Not Submitted">Not Submitted</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        <SelectItem value="Declined">Declined</SelectItem>
                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Terms</Label>
                                <Input placeholder="e.g., COD, Net 15, Net 30" value={customerForm.payment_terms} onChange={(e) => updateCustomerField('payment_terms', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes / Special Instructions</Label>
                            <Input value={customerForm.notes} onChange={(e) => updateCustomerField('notes', e.target.value)} className={isDark ? 'bg-slate-800 border-slate-700 text-white' : ''} />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                            <Button type="button" variant="outline" onClick={() => setShowCustomerForm(false)}>Cancel</Button>
                            <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={createCustomer.isPending}>
                                {createCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Save Customer
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
