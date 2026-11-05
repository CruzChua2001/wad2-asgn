import ScanResultsLayout from "./results-layout";

// Every scan id is a new page, but all of them look the same until the scan loads in the browser.
// An empty list makes Next.js treat /scan/[id]/* as static: each tab is prefetched in full and opens without waiting for the server
export const generateStaticParams = async () => [];

export default function Layout({ children }) {
    return <ScanResultsLayout>{children}</ScanResultsLayout>;
}
