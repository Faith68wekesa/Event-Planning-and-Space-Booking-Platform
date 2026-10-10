import re
import os

with open("src/App.tsx", "r") as f:
    content = f.read()

# Replace the specific login/register imports with AuthModal
import_pattern = r"import \{ VendorRegistration \} from '\./components/VendorRegistration\.tsx';.*?import \{ CustomerRegistration \} from '\./components/CustomerRegistration\.tsx';"
new_imports = "import { AuthModal } from './components/AuthModal.tsx';"
content = re.sub(import_pattern, new_imports, content, flags=re.DOTALL)

# Default to landing page instead of splash
content = content.replace("useState<string>('splash')", "useState<string>('landing')")

# Remove all the specific show login/register states
state_pattern = r"const \[showRegistration, setShowRegistration\].*?const \[currentCustomer, setCurrentCustomer\] = useState<UserType \| null>\(null\);"
new_states = """const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);
  const [currentVenueOwner, setCurrentVenueOwner] = useState<VenueOwner | null>(null);"""
content = re.sub(state_pattern, new_states, content, flags=re.DOTALL)

# Replace currentCustomer references
content = content.replace("if (!currentCustomer)", "if (!currentUser)")
content = content.replace("setCurrentCustomer(user)", "setCurrentUser(user)")
content = content.replace("currentCustomer={currentCustomer}", "currentUser={currentUser}")
content = content.replace("currentCustomer.id", "currentUser.id")
content = content.replace("[currentCustomer]", "[currentUser]")
content = content.replace("if (currentCustomer) {", "if (currentUser) {")
content = content.replace("setCurrentCustomer(null)", "setCurrentUser(null)")
content = content.replace("setCurrentCustomer", "setCurrentUser")
content = content.replace("currentCustomer", "currentUser")

# Update Navbar props
content = content.replace("onLoginClick={() => setShowCustomerLogin(true)}", "onLoginClick={() => { setAuthMode('login'); setShowAuthModal(true); }}")
content = content.replace("onRegisterClick={() => setShowCustomerRegistration(true)}", "onRegisterClick={() => { setAuthMode('register'); setShowAuthModal(true); }}")

# Handle handleInterceptBook
content = content.replace("setShowCustomerLogin(true)", "setAuthMode('login'); setShowAuthModal(true);")

# Remove splash page and old modals rendering
splash_pattern = r"\{activeTab === 'splash' \? \(.*?\) : \(\s*<>\s*<Navbar"
content = re.sub(splash_pattern, "<>\n          <Navbar", content, flags=re.DOTALL)

# Fix the closing tags at the end of the return statement
content = content.replace("</footer>\n        </>\n      )}\n", "</footer>\n        </>\n")

# Replace all old modals with AuthModal
modals_pattern = r"\{showRegistration && \(.*?\{showCustomerRegistration && \(.*?\)\s*\}"
auth_modal = """{showAuthModal && (
        <AuthModal
          initialMode={authMode}
          onClose={() => {
            setShowAuthModal(false);
            setBookingTargetVenue(null);
            setBookingTargetVendor(null);
          }}
          onSuccess={(data) => {
            setShowAuthModal(false);
            setCurrentUser(data.user);
            if (data.vendor_profile) setCurrentVendor(data.vendor_profile);
            if (data.venue_owner_profile) setCurrentVenueOwner(data.venue_owner_profile);
            
            // Set primary active role based on selection or roles available
            if (data.user.is_vendor) {
              setActiveRole('VENDOR');
              setActiveTab('vendor-dashboard');
            } else if (data.user.is_venue_owner) {
              setActiveRole('VENUE_OWNER');
              setActiveTab('venue-owner-dashboard');
            } else {
              setActiveRole('CUSTOMER');
              // If there's a booking target, we might want to trigger the modal open here
              // For now, we just stay on landing
            }
          }}
        />
      )}"""
content = re.sub(modals_pattern, auth_modal, content, flags=re.DOTALL)

with open("src/App.tsx", "w") as f:
    f.write(content)

files_to_remove = [
    "src/components/CustomerLogin.tsx",
    "src/components/CustomerRegistration.tsx",
    "src/components/VendorLogin.tsx",
    "src/components/VendorRegistration.tsx",
    "src/components/VenueOwnerLogin.tsx",
    "src/components/VenueOwnerRegistration.tsx",
    "src/components/SplashPage.tsx"
]
for f in files_to_remove:
    if os.path.exists(f):
        os.remove(f)
