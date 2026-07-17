import ActNow from './pages/ActNow';
import Automations from './pages/Automations';
import CSManagement from './pages/CSManagement';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import ImportLeads from './pages/ImportLeads';
import LeadDetails from './pages/LeadDetails';
import Leads from './pages/Leads';
import MarketingSequences from './pages/MarketingSequences';
import MarketingTemplates from './pages/MarketingTemplates';
import Opportunities from './pages/Opportunities';
import Reports from './pages/Reports';
import SalesGalaxy from './pages/SalesGalaxy';
import SearchResults from './pages/SearchResults';
import SequenceBuilder from './pages/SequenceBuilder';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import TemplateEditor from './pages/TemplateEditor';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActNow": ActNow,
    "Automations": Automations,
    "CSManagement": CSManagement,
    "Dashboard": Dashboard,
    "Home": Home,
    "ImportLeads": ImportLeads,
    "LeadDetails": LeadDetails,
    "Leads": Leads,
    "MarketingSequences": MarketingSequences,
    "MarketingTemplates": MarketingTemplates,
    "Opportunities": Opportunities,
    "Reports": Reports,
    "SalesGalaxy": SalesGalaxy,
    "SearchResults": SearchResults,
    "SequenceBuilder": SequenceBuilder,
    "Settings": Settings,
    "Tasks": Tasks,
    "TemplateEditor": TemplateEditor,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};