import re
import os

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

content = read_file("src/App.tsx")

# Fix handleCustomerLoginSuccess
content = re.sub(r"const handleCustomerLoginSuccess = \(user: UserType\) => \{.*?// If bookingTarget exists, the BookingModal will now open\s*\};\s*", "", content, flags=re.DOTALL)

# Fix Missing LandingPage import if any (it might be missing if I replaced too much)
if "import { LandingPage }" not in content:
    content = content.replace("import { Navbar }", "import { LandingPage } from './components/LandingPage.tsx';\nimport { Navbar }")

# Replace any remaining setShowCustomerLogin or setShowRegistration
content = content.replace("setShowRegistration", "setShowAuthModal")
content = content.replace("setShowVenueOwnerRegistration", "setShowAuthModal")
content = content.replace("setShowCustomerLogin", "setShowAuthModal")
content = content.replace("setShowCustomerRegistration", "setShowAuthModal")

write_file("src/App.tsx", content)

# Fix Navbar.tsx
nav_content = read_file("src/components/Navbar.tsx")
nav_content = nav_content.replace("currentCustomer", "currentUser")
nav_content = nav_content.replace("currentCustomer?: User | null;", "currentUser?: User | null;")
write_file("src/components/Navbar.tsx", nav_content)

# Fix CustomerDashboard.tsx
cd_content = read_file("src/components/CustomerDashboard.tsx")
cd_content = cd_content.replace("currentCustomer", "currentUser")
write_file("src/components/CustomerDashboard.tsx", cd_content)

# Fix BookingModal.tsx
bm_content = read_file("src/components/BookingModal.tsx")
bm_content = bm_content.replace("currentCustomer", "currentUser")
write_file("src/components/BookingModal.tsx", bm_content)

# Fix VendorDashboard.tsx
vd_content = read_file("src/components/VendorDashboard.tsx")
vd_content = vd_content.replace("vendor.profile_picture", "(vendor.logo_url || vendor.user_details?.avatar_url)")
vd_content = vd_content.replace("setUnreadMessages(0);", "") # remove unused
write_file("src/components/VendorDashboard.tsx", vd_content)

# Fix VenueOwnerDashboard.tsx
vo_content = read_file("src/components/VenueOwnerDashboard.tsx")
vo_content = vo_content.replace("owner.profile_picture", "(owner.logo_url || owner.user_details?.avatar_url)")
vo_content = vo_content.replace("<User ", "<UserIcon ")
vo_content = vo_content.replace("import { User, ", "import { User as UserIcon, ")
vo_content = vo_content.replace("import { User }", "import { User as UserIcon }")
write_file("src/components/VenueOwnerDashboard.tsx", vo_content)
