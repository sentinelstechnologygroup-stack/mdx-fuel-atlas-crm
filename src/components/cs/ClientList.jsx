import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import moment from "moment";

export default function ClientList({ clients, onSelectClient }) {
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const [search, setSearch] = useState("");
    
    // Scroll Logic
    const scrollContainerRef = React.useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setShowLeftArrow(scrollLeft > 0);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
        }
    };

    React.useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [clients]);

    const scroll = (direction) => {
        if (scrollContainerRef.current) {
            const amount = 200;
            scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
            setTimeout(checkScroll, 300);
        }
    };

    const filteredClients = clients.filter(c => 
        c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    const getHealthBadge = (score) => {
        if (score >= 80) return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Healthy ({score})</Badge>;
        if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Warning ({score})</Badge>;
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Critical ({score})</Badge>;
    };

    return (
        <div className={`rounded-xl border shadow-lg backdrop-blur-xl ${isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'}`}>
            <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center">
                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Customer Accounts</h3>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Search customers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`pl-8 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : ''}`}
                    />
                </div>
            </div>
            <div className="relative group/table">
                {showLeftArrow && (
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 h-12 w-8 rounded-r-xl rounded-l-none shadow-lg border transition-all ${
                            isDark 
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => scroll('left')}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                )}
                {showRightArrow && (
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 h-12 w-8 rounded-l-xl rounded-r-none shadow-lg border transition-all ${
                            isDark 
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => scroll('right')}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                )}
                <div 
                    ref={scrollContainerRef}
                    onScroll={checkScroll}
                    className="overflow-x-auto scroll-smooth"
                >
                <Table>
                    <TableHeader className={isDark ? 'bg-slate-900/50' : 'bg-slate-50'}>
                        <TableRow className={isDark ? 'border-slate-700' : ''}>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Company</TableHead>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Fuel Type</TableHead>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Gallons / Month</TableHead>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Credit</TableHead>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Next Follow-Up</TableHead>
                            <TableHead className={isDark ? 'text-slate-400' : ''}>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.map((client) => (
                            <TableRow key={client.id} className={`cursor-pointer transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'hover:bg-slate-50'}`} onClick={() => onSelectClient(client)}>
                                <TableCell className="font-medium">
                                    <div className={isDark ? 'text-white' : 'text-slate-900'}>{client.company_name || client.full_name}</div>
                                    <div className="text-xs text-slate-500">{client.full_name}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={isDark ? 'border-slate-600 text-slate-300' : ''}>{client.primary_fuel_type || client.product_type || 'Fuel Account'}</Badge>
                                </TableCell>
                                <TableCell>
                                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                                        {Number(client.estimated_monthly_gallons || 0).toLocaleString()} gal
                                    </span>
                                </TableCell>
                                <TableCell>{client.credit_status || getHealthBadge(client.health_score)}</TableCell>
                                <TableCell className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                                    {client.next_follow_up ? moment(client.next_follow_up).format("MMM D, YYYY") : '-'}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" className={isDark ? 'text-slate-400 hover:text-white' : ''}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            </div>
        </div>
    );
}
