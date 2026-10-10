import re

with open("core/views.py", "r") as f:
    content = f.read()

# Remove register_vendor, login_vendor, register_venue_owner, login_venue_owner, register_customer, login_customer
content = re.sub(r"@api_view\(\['POST'\]\)\n@transaction\.atomic\ndef register_vendor.*?return Response\({'error': str\(e\)}, status=status\.HTTP_400_BAD_REQUEST\)", "", content, flags=re.DOTALL)
content = re.sub(r"@api_view\(\['POST'\]\)\ndef login_vendor.*?return Response\({'error': 'Invalid credentials\. Please verify your password\.'}, status=status\.HTTP_401_UNAUTHORIZED\)", "", content, flags=re.DOTALL)
content = re.sub(r"@api_view\(\['POST'\]\)\n@transaction\.atomic\ndef register_venue_owner.*?return Response\({'error': str\(e\)}, status=status\.HTTP_400_BAD_REQUEST\)", "", content, flags=re.DOTALL)
content = re.sub(r"@api_view\(\['POST'\]\)\ndef login_venue_owner.*?return Response\({'error': 'Invalid credentials\. Please verify your password\.'}, status=status\.HTTP_401_UNAUTHORIZED\)", "", content, flags=re.DOTALL)
content = re.sub(r"@api_view\(\['POST'\]\)\n@transaction\.atomic\ndef register_customer.*?return Response\({'error': str\(e\)}, status=status\.HTTP_400_BAD_REQUEST\)", "", content, flags=re.DOTALL)
content = re.sub(r"@api_view\(\['POST'\]\)\ndef login_customer.*?return Response\({'error': 'Invalid credentials\. Please verify your password\.'}, status=status\.HTTP_401_UNAUTHORIZED\)", "", content, flags=re.DOTALL)

new_views = """
@api_view(['POST'])
@transaction.atomic
def register_user(request):
    data = request.data
    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip() or email

    if not email:
        return Response({'error': 'Email address is required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'An account with this email address already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'This username is already taken'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        full_name = data.get('full_name', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        if full_name and not (first_name or last_name):
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=data.get('password'),
            first_name=first_name,
            last_name=last_name,
            is_customer=True, # default role
            phone_number=data.get('phone_number', '')
        )
        
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def login_user(request):
    login_identifier = (request.data.get('username') or request.data.get('email') or '').strip()
    password = request.data.get('password')
    
    user_obj = User.objects.filter(Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)).first()
    if not user_obj:
        return Response({'error': 'No account found with this email or username'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(username=user_obj.username, password=password)
    
    if user is not None:
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner
            }
        }
        
        if user.is_vendor and hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if user.is_venue_owner and hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
    else:
        return Response({'error': 'Invalid credentials. Please verify your password.'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@transaction.atomic
def request_role(request):
    user_id = request.data.get('user_id')
    role = request.data.get('role')
    
    if not user_id or not role:
        return Response({'error': 'User ID and role are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = User.objects.get(id=user_id)
        
        if role == 'CUSTOMER':
            user.is_customer = True
            user.save()
        elif role == 'VENDOR':
            if not user.is_vendor:
                user.is_vendor = True
                user.save()
                # Create empty profile
                VendorProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'business_name': f"{user.first_name}'s Business" if user.first_name else "My Business",
                        'vendor_type': 'Other',
                        'location': '',
                        'contact_email': user.email,
                        'contact_phone': user.phone_number
                    }
                )
        elif role == 'VENUE_OWNER':
            if not user.is_venue_owner:
                user.is_venue_owner = True
                user.save()
                # Create empty profile
                VenueOwnerProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'business_name': f"{user.first_name}'s Venues" if user.first_name else "My Venues",
                        'contact_email': user.email,
                        'contact_phone': user.phone_number,
                        'business_type': 'Event Venue'
                    }
                )
        else:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Refetch to get updated profiles
        response_data = {
            'user': UserSerializer(user).data,
            'roles': {
                'is_customer': user.is_customer,
                'is_vendor': user.is_vendor,
                'is_venue_owner': user.is_venue_owner
            }
        }
        
        if user.is_vendor and hasattr(user, 'vendor_profile'):
            response_data['vendor_profile'] = VendorProfileSerializer(user.vendor_profile).data
            
        if user.is_venue_owner and hasattr(user, 'venue_owner_profile'):
            response_data['venue_owner_profile'] = VenueOwnerProfileSerializer(user.venue_owner_profile).data
            
        return Response(response_data, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
"""

with open("core/views.py", "w") as f:
    f.write(content + "\n" + new_views)
