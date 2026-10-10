import re

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# VendorDashboard
vd_content = read_file("src/components/VendorDashboard.tsx")
vd_content = re.sub(r"vendor\.profile_picture", "vendor.logo_url", vd_content)
vd_content = re.sub(r"vendor\?\.profile_picture", "vendor?.logo_url", vd_content)
vd_content = re.sub(r"const \[unreadMessages, setUnreadMessages\] = useState\(0\);", "const [unreadMessages] = useState(0);", vd_content)
write_file("src/components/VendorDashboard.tsx", vd_content)

# VenueOwnerDashboard
vo_content = read_file("src/components/VenueOwnerDashboard.tsx")
vo_content = re.sub(r"owner\.profile_picture", "owner.logo_url", vo_content)
vo_content = re.sub(r"owner\?\.profile_picture", "owner?.logo_url", vo_content)
vo_content = re.sub(r"import\s*\{\s*.*?User\s*\}", "import { User as UserIcon }", vo_content) # Let's be careful with imports
if "UserIcon" not in vo_content[:500]:
    vo_content = vo_content.replace("import { User,", "import { User as UserIcon,")
    vo_content = vo_content.replace("import { User }", "import { User as UserIcon }")
write_file("src/components/VenueOwnerDashboard.tsx", vo_content)

# VendorDashboardBookings
vdb_content = read_file("src/components/VendorDashboardBookings.tsx")
vdb_content = re.sub(r"import \{.*?\} from 'lucide-react';", "", vdb_content) # just remove unused imports
vdb_content = vdb_content.replace(", onUpdateStatus ", " ")
write_file("src/components/VendorDashboardBookings.tsx", vdb_content)

# VendorDashboardPortfolio
vdp_content = read_file("src/components/VendorDashboardPortfolio.tsx")
vdp_content = vdp_content.replace(" Briefcase,", "")
write_file("src/components/VendorDashboardPortfolio.tsx", vdp_content)

# VendorDashboardReviews
vdr_content = read_file("src/components/VendorDashboardReviews.tsx")
vdr_content = vdr_content.replace(" MessageCircle,", "")
write_file("src/components/VendorDashboardReviews.tsx", vdr_content)

