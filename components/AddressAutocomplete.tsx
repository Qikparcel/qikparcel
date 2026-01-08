"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AddressSuggestion {
  id: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    mapbox_id: string;
    feature_type: string;
    full_address?: string;
    name: string;
    name_preferred?: string;
    place_formatted?: string;
    coordinates?: {
      longitude: number;
      latitude: number;
    };
    context?: {
      region?: {
        name: string;
        region_code?: string;
      };
      country?: {
        name: string;
        country_code?: string;
      };
      place?: {
        name: string;
      };
      locality?: {
        name: string;
      };
      postcode?: {
        name: string;
      };
      street?: {
        name: string;
      };
      address?: {
        name: string;
        address_number?: string;
      };
    };
  };
}

interface AddressFields {
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  coordinates?: {
    longitude: number;
    latitude: number;
  };
}

interface AddressAutocompleteProps {
  label: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  onAddressChange: (fields: AddressFields) => void;
  required?: boolean;
  placeholder?: string;
}

export default function AddressAutocomplete({
  label,
  streetAddress,
  addressLine2,
  city,
  state,
  postcode,
  country,
  onAddressChange,
  required = false,
  placeholder = "Start typing an address...",
}: AddressAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mapbox token - should be in environment variable
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoicWlrcGFyY2VsMjAyNSIsImEiOiJjbWs0Ym5kMDkwNW1xM2VxbTM2ZGZlYjZxIn0.5eSh6X3vFx_I2Y5rSM7nkQ";

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch suggestions from Mapbox Geocoding API
  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);
      try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodedQuery}&access_token=${MAPBOX_TOKEN}&limit=5&types=address,place,postcode&autocomplete=true`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch address suggestions");
        }

        const data = await response.json();
        console.log("Mapbox API Response:", data);
        if (data.features && Array.isArray(data.features)) {
          console.log("Found", data.features.length, "suggestions");
          setSuggestions(data.features);
          setShowSuggestions(true);
        } else {
          console.log("No features found in response");
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error fetching address suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [MAPBOX_TOKEN]
  );

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (searchQuery && !selectedSuggestion) {
        fetchSuggestions(searchQuery);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchSuggestions, selectedSuggestion]);

  // Parse Mapbox response to extract address components
  const parseAddress = (suggestion: AddressSuggestion): AddressFields => {
    const context = suggestion.properties?.context || {};
    const featureType = suggestion.properties?.feature_type || "";
    
    // Extract components from context object (Mapbox v6 structure)
    let parsedCity = "";
    let parsedState = "";
    let parsedPostcode = "";
    let parsedCountry = "";
    let parsedStreet = "";

    // Extract from context object
    if (context.place) {
      parsedCity = context.place.name || "";
    } else if (context.locality) {
      parsedCity = context.locality.name || "";
    }

    if (context.region) {
      parsedState = context.region.name || "";
    }

    if (context.postcode) {
      parsedPostcode = context.postcode.name || "";
    }

    if (context.country) {
      parsedCountry = context.country.name || "";
    }

    // Extract street address based on feature type
    if (featureType === "address") {
      // For address features, properties.name already includes the full address with number
      // (e.g., "1 Epsom Close"), so use it directly to avoid duplication
      if (suggestion.properties.name) {
        parsedStreet = suggestion.properties.name;
      } else if (context.address) {
        // Fallback: construct from context only if name is not available
        // Check if context.address.name already includes the number
        const addressName = context.address.name || "";
        const addressNumber = context.address.address_number || "";
        
        if (addressNumber && addressName.startsWith(addressNumber.trim())) {
          // Name already contains the number, use it as-is
          parsedStreet = addressName;
        } else if (addressName && addressNumber) {
          // Name doesn't contain number, combine them
          parsedStreet = `${addressNumber} ${addressName}`.trim();
        } else {
          // Use whichever is available
          parsedStreet = addressName || addressNumber || "";
        }
      } else if (context.street) {
        parsedStreet = context.street.name || "";
      }
    } else if (context.street) {
      parsedStreet = context.street.name || "";
    } else {
      // For place features (city, locality, etc.), leave street empty
      parsedStreet = "";
    }

    // Get coordinates
    const coords = suggestion.properties?.coordinates || 
                   (suggestion.geometry?.coordinates ? {
                     longitude: suggestion.geometry.coordinates[0],
                     latitude: suggestion.geometry.coordinates[1]
                   } : undefined);

    return {
      streetAddress: parsedStreet,
      addressLine2: "", // Mapbox doesn't provide this separately
      city: parsedCity,
      state: parsedState,
      postcode: parsedPostcode,
      country: parsedCountry,
      coordinates: coords,
    };
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const parsed = parseAddress(suggestion);
    // Use full_address if available, otherwise use name
    const displayName = suggestion.properties?.full_address || 
                       suggestion.properties?.name || 
                       suggestion.properties?.place_formatted || 
                       "";
    setSearchQuery(displayName);
    setSelectedSuggestion(suggestion.id);
    setShowSuggestions(false);
    onAddressChange(parsed);
  };

  // Handle manual input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedSuggestion(null);
    
    // If user clears the search, clear all fields
    if (!value.trim()) {
      onAddressChange({
        streetAddress: "",
        addressLine2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      });
    }
  };

  // Build current address string for display
  const currentAddressString = [
    streetAddress,
    addressLine2,
    city,
    state,
    postcode,
    country,
  ]
    .filter((part) => part && part.trim())
    .join(", ");

  // Initialize search query from existing address fields
  useEffect(() => {
    if (!selectedSuggestion && currentAddressString && !searchQuery) {
      setSearchQuery(currentAddressString);
    }
  }, []);

  return (
    <div className="space-y-4" ref={wrapperRef}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && "*"}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery || currentAddressString}
            onChange={handleSearchChange}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder}
            required={required}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            </div>
          )}
          
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((suggestion) => {
                const displayName = suggestion.properties?.full_address || 
                                   suggestion.properties?.name || 
                                   suggestion.properties?.place_formatted || 
                                   "Unknown location";
                const featureType = suggestion.properties?.feature_type || "";
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {displayName}
                    </div>
                    {featureType && (
                      <div className="text-xs text-gray-500 mt-1 capitalize">
                        {featureType}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Start typing to search for an address
        </p>
      </div>

      {/* Structured address fields (auto-filled, but editable) */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Street Address {required && "*"}
          </label>
          <input
            type="text"
            value={streetAddress}
            onChange={(e) =>
              onAddressChange({
                streetAddress: e.target.value,
                addressLine2,
                city,
                state,
                postcode,
                country,
              })
            }
            placeholder="123 Main Street"
            required={required}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) =>
              onAddressChange({
                streetAddress,
                addressLine2: e.target.value,
                city,
                state,
                postcode,
                country,
              })
            }
            placeholder="Apartment, suite, unit, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City {required && "*"}
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) =>
                onAddressChange({
                  streetAddress,
                  addressLine2,
                  city: e.target.value,
                  state,
                  postcode,
                  country,
                })
              }
              placeholder="City"
              required={required}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State/Province {required && "*"}
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) =>
                onAddressChange({
                  streetAddress,
                  addressLine2,
                  city,
                  state: e.target.value,
                  postcode,
                  country,
                })
              }
              placeholder="State"
              required={required}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postcode {required && "*"}
            </label>
            <input
              type="text"
              value={postcode}
              onChange={(e) =>
                onAddressChange({
                  streetAddress,
                  addressLine2,
                  city,
                  state,
                  postcode: e.target.value,
                  country,
                })
              }
              placeholder="Postcode"
              required={required}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country {required && "*"}
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) =>
                onAddressChange({
                  streetAddress,
                  addressLine2,
                  city,
                  state,
                  postcode,
                  country: e.target.value,
                })
              }
              placeholder="Country"
              required={required}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

