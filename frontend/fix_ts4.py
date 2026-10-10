import re

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# VendorDashboard
vd_content = read_file("src/components/VendorDashboard.tsx")
vd_content = vd_content.replace("currentVendor.user_details?.avatar_url = newUrl;", "currentVendor.logo_url = newUrl;")
write_file("src/components/VendorDashboard.tsx", vd_content)

# VenueOwnerDashboard
vo_content = read_file("src/components/VenueOwnerDashboard.tsx")
vo_content = vo_content.replace("currentOwner.user_details?.avatar_url = newUrl;", "currentOwner.logo_url = newUrl;")
vo_content = vo_content.replace("<User ", "<UserIcon ")
vo_content = vo_content.replace("import { User as UserIcon", "import { User as UserIcon ") # if not there
if "import { User as UserIcon" not in vo_content:
    vo_content = vo_content.replace("import { User,", "import { User as UserIcon,")
write_file("src/components/VenueOwnerDashboard.tsx", vo_content)

