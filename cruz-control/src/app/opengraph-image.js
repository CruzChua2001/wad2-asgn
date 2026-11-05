import { siteImage } from "@/lib/og";

export const alt = "CruzControl: Public Exposure, Made Clear. Passive, read-only checks of your website and public GitHub repo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const Image = async _ => siteImage();

export default Image;
