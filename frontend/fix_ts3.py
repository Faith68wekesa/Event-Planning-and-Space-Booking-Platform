import re

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# VendorDashboard
vd_content = read_file("src/components/VendorDashboard.tsx")
vd_content = vd_content.replace("currentVendor.profile_picture", "currentVendor.user_details?.avatar_url")
write_file("src/components/VendorDashboard.tsx", vd_content)

# VenueOwnerDashboard
vo_content = read_file("src/components/VenueOwnerDashboard.tsx")
vo_content = vo_content.replace("currentOwner.profile_picture", "currentOwner.user_details?.avatar_url")
vo_content = vo_content.replace("owner.profile_picture", "owner.user_details?.avatar_url")
vo_content = vo_content.replace("<UserIcon ", "<User ")
vo_content = vo_content.replace("import { User as UserIcon", "import { User")
write_file("src/components/VenueOwnerDashboard.tsx", vo_content)

# VendorDashboardPortfolio
vdp_content = read_file("src/components/VendorDashboardPortfolio.tsx")
vdp_content = vdp_content.replace("import { Camera, Plus, Trash2, Edit2, CheckCircle, X, MapPin, DollarSign, Users, Calendar, Briefcase }", "import { Camera, Plus, Trash2, Edit2, CheckCircle, X, MapPin, DollarSign, Users, Calendar }")
vdp_content = vdp_content.replace("import { Camera, Plus, Trash2, Edit2, CheckCircle, X, MapPin, DollarSign, Users, Calendar, Briefcase,", "import { Camera, Plus, Trash2, Edit2, CheckCircle, X, MapPin, DollarSign, Users, Calendar,")
write_file("src/components/VendorDashboardPortfolio.tsx", vdp_content)
