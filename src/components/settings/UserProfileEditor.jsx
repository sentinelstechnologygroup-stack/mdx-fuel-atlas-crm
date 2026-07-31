import { useState } from 'react';
import { atlas } from '@/api/atlasClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';

const PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'job_title',
  'department',
  'employee_id',
  'monthly_gallon_quota',
  'service_area_notes',
];

function initialForm(user) {
  return Object.fromEntries(PROFILE_FIELDS.map((field) => [field, user?.[field] ?? '']));
}

export default function UserProfileEditor({ user, onCancel, onSaved }) {
  const [form, setForm] = useState(() => initialForm(user));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim().toLowerCase();
    const quota = form.monthly_gallon_quota === '' ? null : Number(form.monthly_gallon_quota);

    if (!firstName || !lastName) {
      toast({ title: 'First and last name are required.', variant: 'destructive' });
      return;
    }
    if (!email || !email.includes('@')) {
      toast({ title: 'A valid MDX work email is required.', variant: 'destructive' });
      return;
    }
    if (quota !== null && (!Number.isFinite(quota) || quota < 0)) {
      toast({ title: 'Monthly gallon quota must be zero or greater.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const value = {
        ...form,
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`.trim(),
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        monthly_gallon_quota: quota,
      };

      const response = await atlas.functions.invoke('updateUserAccount', {
        action: 'profile',
        target_user_id: user.id,
        value,
      });

      if (response?.data?.error) throw new Error(response.data.error);
      toast({ title: 'Employee profile updated' });
      onSaved?.();
    } catch (error) {
      toast({
        title: 'Profile update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogDescription>
        Protected identity and employment fields. Changes must be authorized and recorded in the audit trail.
      </DialogDescription>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-amber-900">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p className="text-xs">
          Use the employee’s approved MDX name and company email. Email changes may affect login access and must also be
          validated by the server.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>MDX Work Email</Label>
          <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Employee ID</Label>
          <Input value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Job Title</Label>
          <Input value={form.job_title} onChange={(e) => update('job_title', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Input value={form.department} onChange={(e) => update('department', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Monthly Gallon Quota</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={form.monthly_gallon_quota}
            onChange={(e) => update('monthly_gallon_quota', e.target.value)}
            placeholder="e.g., 250000"
          />
          <p className="text-xs text-slate-500">Sales goals are entered and reported in gallons, never dollars.</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Service Area Notes</Label>
          <Textarea value={form.service_area_notes} onChange={(e) => update('service_area_notes', e.target.value)} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Protected Profile'}
        </Button>
      </DialogFooter>
    </>
  );
}
