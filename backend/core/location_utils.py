from django.db.models import Q


NYERI_COUNTY_LOCATION = 'Nyeri County, Kenya'

NYERI_COUNTY_LOCATION_ALIASES = (
    'Nyeri',
    'Nyeri County',
    'Nyeri, Kenya',
    NYERI_COUNTY_LOCATION,
    'Nyeri Town',
    'Nyeri Town, Kenya',
    'Karatina',
    'Karatina, Kenya',
    'Karatina, Nyeri County',
    'Othaya',
    'Othaya, Kenya',
    'Othaya, Nyeri County',
    'Mukurweini',
    'Mukurweini, Kenya',
    'Mukurweini, Nyeri County',
    'Mathira',
    'Mathira, Nyeri County',
    'Tetu',
    'Tetu, Nyeri County',
    'Kieni',
    'Kieni, Nyeri County',
    'Naro Moru',
    'Naro Moru, Kenya',
    'Naro Moru, Nyeri County',
    'Mweiga',
    'Mweiga, Kenya',
    'Mweiga, Nyeri County',
    'Kiganjo',
    'Kiganjo, Kenya',
    'Kiganjo, Nyeri County',
)


def is_nyeri_county_location(location):
    return (
        isinstance(location, str)
        and location.strip().casefold()
        in {alias.casefold() for alias in NYERI_COUNTY_LOCATION_ALIASES}
    )


def nyeri_county_location_filter():
    location_filter = Q()
    for alias in NYERI_COUNTY_LOCATION_ALIASES:
        location_filter |= Q(location__iexact=alias)
    return location_filter
