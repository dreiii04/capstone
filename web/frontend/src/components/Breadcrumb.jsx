import { useLocation } from 'react-router-dom';

const labelMap = {
    'dashboard': 'Dashboard',
    'requests': 'Document Requests',
    'transactions': 'Payments',
    'notifications': 'Notifications',
    'blockchain': 'Blockchain',
    'my-transactions': 'My Records',
    'verify': 'Verify Record',
    'profile': 'Profile',
    'info': 'Information',
    'manage-registrar': 'Manage Registrar',
    'add': 'Add Registrar',
    'details': 'Details',
    'manage-users': 'User Management',
    'activity-logs': 'System Logs',
};

const Breadcrumb = () => {
    const location = useLocation();
    const pathSegments = location.pathname.split('/').filter(Boolean);

    if (pathSegments.length <= 1) return null;

    const crumbs = pathSegments.map((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        const isLast = index === pathSegments.length - 1;

        // Check if segment looks like an ID (MongoDB ObjectId, numeric, or request ID format)
        const isId = /^[0-9a-fA-F]{24}$/.test(segment) || /^\d+$/.test(segment) || /^REQ-/i.test(segment);
        const label = isId ? `#${segment.length > 10 ? segment.slice(0, 8) + '...' : segment}` : (labelMap[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

        return { path, label, isLast };
    });

    return (
        <nav aria-label="Breadcrumb" className="px-6 pt-4 pb-1">
            <ol className="flex items-center gap-1.5 text-sm m-0 p-0 list-none">
                {crumbs.map((crumb, index) => (
                    <li key={crumb.path} className="flex items-center gap-1.5">
                        {index > 0 && (
                            <i className="fa-solid fa-chevron-right text-[9px] text-gray-300"></i>
                        )}
                        {crumb.isLast ? (
                            <span className="text-gray-800 font-semibold">{crumb.label}</span>
                        ) : (
                            <span className="text-[#6f8faa]">
                                {crumb.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};

export default Breadcrumb;
