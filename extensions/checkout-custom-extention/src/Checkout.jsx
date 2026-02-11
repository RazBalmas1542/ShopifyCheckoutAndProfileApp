import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useState, useEffect} from "preact/hooks";

// 1. Export the extension
export default async () => {
  render(<Extension />, document.body)
};

function Extension() {
  const [metaObjects, setMetaObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldRender, setShouldRender] = useState(true); // Default to showing content
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Get the configured MetaObject type from settings
  // Settings are accessed via shopify.settings.current[fieldKey]
  // @ts-ignore - Settings structure varies by extension
  const configuredMetaObjectType = (shopify.settings?.current?.metaobject_type || shopify.settings?.metaobject_type || "").trim();
  
  // Get the configured MetaObject handles from settings
  // @ts-ignore - Settings structure varies by extension
  const configuredHandlesRaw = shopify.settings?.current?.metaobject_handles || shopify.settings?.metaobject_handles || "";
  
  // Parse multiple handles from multi-line text field
  // Split by newlines, filter empty lines, and trim each handle
  const configuredMetaObjectHandles = configuredHandlesRaw
    .split(/\r?\n/)
    .map(handle => handle.trim())
    .filter(handle => handle.length > 0);
  
  // Get current language/locale
  // @ts-ignore - i18n locale access
  const currentLanguage = shopify.i18n?.locale || shopify.i18n?.language || "en";
  const isEnglish = currentLanguage.toLowerCase().startsWith("en");
  
  // Get default settings
  // @ts-ignore - Settings structure varies by extension
  const defaultTitle = shopify.settings?.current?.section_title || shopify.settings?.section_title || "";
  // @ts-ignore - Settings structure varies by extension
  const defaultText = shopify.settings?.current?.section_text || shopify.settings?.section_text || "";
  
  // Get English-specific settings
  // @ts-ignore - Settings structure varies by extension
  const englishTitle = shopify.settings?.current?.section_title_en || shopify.settings?.section_title_en || "";
  // @ts-ignore - Settings structure varies by extension
  const englishText = shopify.settings?.current?.section_text_en || shopify.settings?.section_text_en || "";
  
  // Use English settings if language is 'en' and English settings are configured, otherwise use default
  const sectionTitle = (isEnglish && englishTitle) ? englishTitle : defaultTitle;
  const sectionText = (isEnglish && englishText) ? englishText : defaultText;

  // Get conditional rendering settings
  // @ts-ignore - Settings structure varies by extension
  const conditionalResourceType = (shopify.settings?.current?.conditional_resource_type || shopify.settings?.conditional_resource_type || "").trim().toLowerCase();
  // @ts-ignore - Settings structure varies by extension
  const conditionalMetafieldName = (shopify.settings?.current?.conditional_metafield_name || shopify.settings?.conditional_metafield_name || "").trim();
  // @ts-ignore - Settings structure varies by extension
  const conditionalMetafieldValue = (shopify.settings?.current?.conditional_metafield_value || shopify.settings?.conditional_metafield_value || "").trim();
  // @ts-ignore - Settings structure varies by extension
  const conditionalMatchType = (shopify.settings?.current?.conditional_match_type || shopify.settings?.conditional_match_type || "exact match").trim().toLowerCase();
  // @ts-ignore - Settings structure varies by extension
  const conditionalAction = (shopify.settings?.current?.conditional_action || shopify.settings?.conditional_action || "").trim().toLowerCase();

  // Function to check if conditional rendering should show/hide content
  async function shouldShowContent() {
    // If no conditional settings are configured, always show
    if (!conditionalResourceType || !conditionalMetafieldName || !conditionalMetafieldValue) {
      return true;
    }

    let metafieldValue = null;

    try {
      // Check metafield based on resource type
      if (conditionalResourceType === 'product') {
        // Access cart lines - shopify.lines has structure {v: Array, ...}
        // @ts-ignore - Lines structure
        const linesObj = shopify.lines;
        // @ts-ignore - Lines structure - v property contains the array
        const cartLines = linesObj?.v || linesObj || [];
        // Check all products in the cart
        for (const line of cartLines) {
          // @ts-ignore - Line structure
          const product = line?.merchandise?.product;
          const productId = product?.id;
          
          // First, try to get metafields directly from the product object
          // @ts-ignore - Metafields structure
          let allMetafields = [
            ...(product?.metafields || []),
            ...(product?.customMetafields || []),
            ...(product?.custom?.metafields || []),
            ...(product?.metafield ? [product.metafield] : [])
          ];
          
          // If no metafields found directly, fetch from API
          if (allMetafields.length === 0 && productId) {
            const apiMetafields = await fetchProductMetafieldsFromAPI(productId);
            allMetafields = apiMetafields;
          }
          
          if (allMetafields.length > 0) {
            // @ts-ignore - Metafields structure
            const metafield = allMetafields.find(mf => {
              const key = mf?.key || mf?.name || '';
              const namespace = mf?.namespace || '';
              const fullKey = namespace ? `${namespace}.${key}` : key;
              return key === conditionalMetafieldName || 
                     namespace === conditionalMetafieldName ||
                     fullKey === conditionalMetafieldName ||
                     `${namespace}.${key}` === conditionalMetafieldName;
            });
            if (metafield) {
              const foundValue = metafield.value || metafield?.values?.[0] || null;
              // If we haven't found a value yet, or if this is a match, set it
              // Continue checking all products, but keep the first match found
              if (!metafieldValue) {
                metafieldValue = foundValue;
              }
            }
          }
        }
      } else if (conditionalResourceType === 'variant') {
        // Access cart lines - shopify.lines has structure {v: Array, ...}
        // @ts-ignore - Lines structure
        const linesObj = shopify.lines;
        // @ts-ignore - Lines structure - v property contains the array
        const cartLines = linesObj?.v || linesObj || [];
        
        // Check variant metafields (merchandise is the variant)
        for (const line of cartLines) {
          // @ts-ignore - Line structure - merchandise is the variant
          const variant = line?.merchandise;
          const variantId = variant?.id;
          // @ts-ignore - productType is a standard product property
          const product = variant?.product;
          const productId = product?.id;
          
          // Check if the field name matches a standard variant/product property (not a metafield)
          // product_type is a standard Shopify field on products, accessible via variant.product.productType
          if (conditionalMetafieldName.toLowerCase() === 'product_type' || conditionalMetafieldName.toLowerCase() === 'producttype') {
            // @ts-ignore - productType is a standard product property
            if (product?.productType) {
              const foundValue = product.productType;
              // Continue checking all variants, but keep the first match found
              if (!metafieldValue) {
                metafieldValue = foundValue;
              }
              // Continue to next variant
              continue;
            }
            // @ts-ignore - Also check variant directly
            if (variant?.productType) {
              const foundValue = variant.productType;
              // Continue checking all variants, but keep the first match found
              if (!metafieldValue) {
                metafieldValue = foundValue;
              }
              // Continue to next variant
              continue;
            }
          }
          
          // First, try to get metafields directly from the variant object
          // @ts-ignore - Metafields might be in different structure
          let metafields = [
            ...(variant?.metafields || []),
            ...(variant?.customMetafields || []),
            ...(variant?.custom?.metafields || []),
            ...(variant?.metafield ? [variant.metafield] : [])
          ];
          
          // If no metafields found directly, fetch product with variants from API
          if (metafields.length === 0 && variantId && productId) {
            const apiMetafields = await fetchVariantMetafieldsFromAPI(variantId, productId);
            metafields = apiMetafields;
          } else if (metafields.length === 0 && variantId) {
            const apiMetafields = await fetchVariantMetafieldsFromAPI(variantId);
            metafields = apiMetafields;
          }
          
          if (metafields && metafields.length > 0) {
            // @ts-ignore - Metafields structure
            const metafield = metafields.find(mf => {
              const key = mf?.key || mf?.name || '';
              const namespace = mf?.namespace || '';
              const fullKey = namespace ? `${namespace}.${key}` : key;
              return key === conditionalMetafieldName || 
                     namespace === conditionalMetafieldName ||
                     fullKey === conditionalMetafieldName ||
                     `${namespace}.${key}` === conditionalMetafieldName;
            });
            if (metafield) {
              const foundValue = metafield.value || metafield?.values?.[0] || null;
              // Continue checking all variants, but keep the first match found
              if (!metafieldValue) {
                metafieldValue = foundValue;
              }
            }
          }
        }
      } else if (conditionalResourceType === 'customer') {
        // Check customer metafields
        // @ts-ignore - Customer structure
        const customer = shopify.customer;
        
        if (customer) {
          // Combine regular metafields and custom metafields
          // @ts-ignore - Metafields structure
          const allMetafields = [
            ...(customer?.metafields || []),
            ...(customer?.customMetafields || []),
            ...(customer?.custom?.metafields || []),
            ...(customer?.metafield ? [customer.metafield] : [])
          ];
          
          if (allMetafields.length > 0) {
            // @ts-ignore - Metafields structure
            const metafield = allMetafields.find(mf => {
              const key = mf?.key || mf?.name || '';
              const namespace = mf?.namespace?.key || mf?.namespace || '';
              const fullKey = namespace ? `${namespace}.${key}` : key;
              return key === conditionalMetafieldName || 
                     namespace === conditionalMetafieldName ||
                     fullKey === conditionalMetafieldName ||
                     `${namespace}.${key}` === conditionalMetafieldName;
            });
            if (metafield) {
              metafieldValue = metafield.value || metafield?.values?.[0] || null;
            }
          }
        }
      } else if (conditionalResourceType === 'order') {
        // Note: shopify.cart is not available in checkout extensions
        // Try to access checkout/cart metafields via Storefront API or alternative methods
        // @ts-ignore - Try different ways to access checkout/cart
        const checkout = shopify.checkout || shopify['checkout'];
        // @ts-ignore - Try cart alternative
        const cart = shopify.cart || checkout?.cart || shopify['cart'];
        
        // Try to get metafields from checkout or cart if available
        // @ts-ignore - Metafields structure
        const checkoutMetafields = checkout?.metafields || checkout?.customMetafields || [];
        // @ts-ignore - Metafields structure
        const cartMetafields = cart?.metafields || cart?.customMetafields || [];
        
        // Combine all possible sources
        // @ts-ignore - Metafields structure
        const allMetafields = [
          ...(checkoutMetafields || []),
          ...(cartMetafields || []),
          ...(checkout?.custom?.metafields || []),
          ...(cart?.custom?.metafields || []),
          ...(checkout?.metafield ? [checkout.metafield] : []),
          ...(cart?.metafield ? [cart.metafield] : [])
        ];
        
        if (allMetafields.length > 0) {
          // @ts-ignore - Metafields structure
          const metafield = allMetafields.find(mf => {
            const key = mf?.key || mf?.name || '';
            const namespace = mf?.namespace?.key || mf?.namespace || '';
            const fullKey = namespace ? `${namespace}.${key}` : key;
            return key === conditionalMetafieldName || 
                   namespace === conditionalMetafieldName ||
                   fullKey === conditionalMetafieldName ||
                   `${namespace}.${key}` === conditionalMetafieldName;
          });
          if (metafield) {
            metafieldValue = metafield.value || metafield?.values?.[0] || null;
          }
        }
      }
    } catch (err) {
      console.error("Error checking conditional metafield:", err);
      // On error, default to showing content
      return true;
    }

    // Compare metafield value with configured value based on match type
    const metafieldValueStr = String(metafieldValue || '').trim().toLowerCase();
    const configuredValueStr = conditionalMetafieldValue.trim().toLowerCase();
    
    let valueMatches = false;

    // Apply matching logic based on match type
    switch (conditionalMatchType) {
      case 'exact match':
        valueMatches = metafieldValueStr === configuredValueStr;
        break;
      case 'contains':
        valueMatches = metafieldValueStr.includes(configuredValueStr);
        break;
      case 'starts with':
        valueMatches = metafieldValueStr.startsWith(configuredValueStr);
        break;
      case 'ends with':
        valueMatches = metafieldValueStr.endsWith(configuredValueStr);
        break;
      case 'not contains':
        valueMatches = !metafieldValueStr.includes(configuredValueStr);
        break;
      case 'not exact match':
        valueMatches = metafieldValueStr !== configuredValueStr;
        break;
      default:
        // Default to exact match if match type is not recognized
        valueMatches = metafieldValueStr === configuredValueStr;
        break;
    }

    // Determine if content should be shown based on action
    let shouldShow = true;
    if (conditionalAction === 'show when') {
      shouldShow = valueMatches;
    } else if (conditionalAction === 'hide when') {
      shouldShow = !valueMatches;
    }

    return shouldShow;
  }

  // 2. Check instructions for feature availability, see https://shopify.dev/docs/api/checkout-ui-extensions/apis/cart-instructions for details
  if (!shopify.instructions.value.attributes.canUpdateAttributes) {
    // For checkouts such as draft order invoices, cart attributes may not be allowed
    // Consider rendering a fallback UI or nothing at all, if the feature is unavailable
    return (
      <s-banner heading="Checkout Custom Extention" tone="warning">
        {shopify.i18n.translate("attributeChangesAreNotSupported")}
      </s-banner>
    );
  }

  // Check customer validation (login status + location) on component mount
  useEffect(() => {
    // Check if customer is logged in
    // @ts-ignore - Customer structure
    const customer = shopify.customer;
    const isLoggedIn = !!customer;
    
    setIsCustomerLoggedIn(isLoggedIn);

    const locationAdminsName = "Location Admins";

    if (!isLoggedIn) {
      // Customer is not logged in
      setValidationError("You must be logged in to complete this purchase. Please sign in to continue.");
    } else {
      // Customer is logged in, try to read company location if available
      // @ts-ignore - B2B customer structure
      const purchasingCompany = customer?.purchasingCompany || customer?.company;
      // @ts-ignore - Company location structure
      const locationName = purchasingCompany?.location?.name || purchasingCompany?.currentLocation?.name;

      if (!locationName || locationName.trim() !== locationAdminsName) {
        // Wrong or missing location
        setValidationError("Only customers in the 'Location Admins' location are allowed to place orders. Please contact your administrator.");
      } else {
        // Logged in and correct location
        setValidationError(null);
      }
    }
  }, []);

  // Check conditional rendering and fetch MetaObjects on component mount
  useEffect(() => {
    // Check conditional rendering first (async)
    shouldShowContent().then(result => {
      setShouldRender(result);
    }).catch(err => {
      console.error("Error in conditional rendering check:", err);
      setShouldRender(true); // Default to showing on error
    });
    // Then fetch MetaObjects
    fetchMetaObjects();
  }, []);

  async function fetchMetaObjects() {
    setLoading(true);
    setError(null);
    
    try {
      // Use Storefront API directly - no backend needed!
      // This uses the api_access capability which is already enabled
      
      // Check if MetaObject type is configured (required by Storefront API)
      if (!configuredMetaObjectType) {
        setError("MetaObject type is required. Please configure it in the extension settings (e.g., 'global_site_data').");
        setLoading(false);
        return;
      }
      
      // Note: Storefront API requires a 'type' parameter for metaobjects query
      // Use the configured type from settings
      let allMetaObjects = [];
      
      try {
        const data = await getAllShopMetaObjectsFromStorefront({ type: configuredMetaObjectType, limit: 250 });
        if (data.edges && Array.isArray(data.edges) && data.edges.length > 0) {
          allMetaObjects = data.edges.map(edge => edge.node);
        }
      } catch (err) {
        console.error(`Error fetching MetaObjects for type ${configuredMetaObjectType}:`, err);
        setError(`Failed to fetch MetaObjects of type "${configuredMetaObjectType}". Make sure the type exists in your store.`);
        setLoading(false);
        return;
      }
      
      // Filter MetaObjects by configured handles if specified
      if (configuredMetaObjectHandles.length > 0) {
        // Normalize handles for case-insensitive comparison
        const normalizedHandles = configuredMetaObjectHandles.map(h => h.toLowerCase().trim());
        
        const filtered = allMetaObjects.filter(mo => {
          const moHandle = mo.handle?.toLowerCase() || "";
          const moId = mo.id || "";
          // Match by handle or if ID contains the handle
          return normalizedHandles.some(handle => 
            moHandle === handle || 
            moId.includes(handle) ||
            moHandle.includes(handle)
          );
        });
        
        if (filtered.length === 0) {
          const availableHandles = allMetaObjects.map(mo => mo.handle || 'N/A').filter(h => h !== 'N/A');
          setError(`No MetaObjects found with configured handles "${configuredMetaObjectHandles.join('", "')}". Available handles: ${availableHandles.length > 0 ? availableHandles.join(', ') : 'None'}`);
          setMetaObjects([]);
        } else {
          setMetaObjects(filtered);
        }
      } else {
        // Show all MetaObjects if no handles are configured
        if (allMetaObjects.length === 0) {
          setError(`No MetaObjects found for type "${configuredMetaObjectType}". Make sure you have MetaObjects of this type created in your store.`);
        } else {
          setMetaObjects(allMetaObjects);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to fetch MetaObjects");
      console.error("Error fetching MetaObjects:", err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetches product metafields via Storefront API
   * @param {string} productId - Product GID (e.g., "gid://shopify/Product/123")
   * @returns {Promise<Array>} Array of metafields
   */
  async function fetchProductMetafieldsFromAPI(productId) {
    try {
      if (!productId) {
        return [];
      }

      const query = `
        query getProductMetafields($id: ID!) {
          product(id: $id) {
            id
            metafields(first: 250) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      `;

      const variables = { id: productId };
      // @ts-ignore - shopify.query accepts variables as second parameter
      const response = await shopify.query(query, { variables });

      if (response.errors) {
        console.error(`[Metafield Retrieval] GraphQL errors fetching product metafields:`, response.errors);
        return [];
      }

      // @ts-ignore - Response structure from Storefront API
      const metafields = response.data?.product?.metafields?.edges || [];
      return metafields.map(edge => edge.node);
    } catch (error) {
      console.error(`[Metafield Retrieval] Error fetching product metafields from API:`, error);
      return [];
    }
  }

  /**
   * Fetches product with all variants and their metafields via Storefront API
   * @param {string} productId - Product GID (e.g., "gid://shopify/Product/123")
   * @param {string} metafieldName - Metafield name to query (e.g., "custom.product_type")
   * @returns {Promise<Object>} Product object with variants and metafields
   */
  async function fetchProductWithVariantsFromAPI(productId, metafieldName = null) {
    try {
      if (!productId) {
        return null;
      }

      // Note: Storefront API requires 'identifiers' argument for metafields
      // We'll fetch all variants first, then query metafields for each variant
      const query = `
        query getProductWithVariants($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      `;

      const variables = { id: productId };
      
      // @ts-ignore - shopify.query accepts variables as second parameter
      const response = await shopify.query(query, { variables });

      if (response.errors) {
        console.error(`[Metafield Retrieval] GraphQL errors fetching product with variants:`, response.errors);
        console.error(`[Metafield Retrieval] Full error details:`, JSON.stringify(response.errors, null, 2));
        return null;
      }

      // @ts-ignore - Response structure from Storefront API
      const product = response.data?.product;
      
      if (!product) {
        return null;
      }
      
      // Now fetch metafields for each variant
      // Storefront API requires specific identifiers, so we'll query each variant individually
      const variants = product.variants?.edges || [];
      const variantsWithMetafields = [];
      
      for (const variantEdge of variants) {
        const variant = variantEdge.node;
        // Query metafields for this variant using node query
        // We'll try querying without identifiers first to see what's available
        try {
          // Storefront API requires specific metafield identifiers
          // Construct identifier from metafieldName (e.g., "custom.product_type" -> ["custom.product_type"])
          // If metafieldName is not provided, we can't query metafields
          let metafieldIdentifiers = [];
          if (metafieldName) {
            // The identifier format is typically "{namespace}.{key}"
            metafieldIdentifiers = [metafieldName];
          } else {
            // If no metafield name provided, skip querying metafields
            variantsWithMetafields.push({
              ...variant,
              metafields: []
            });
            continue;
          }
          
          const metafieldQuery = `
            query getVariantMetafields($id: ID!, $identifiers: [HasMetafieldsIdentifier!]!) {
              node(id: $id) {
                ... on ProductVariant {
                  id
                  metafields(identifiers: $identifiers) {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          `;
          
          // Parse the metafield name (e.g., "custom.product_type" -> namespace: "custom", key: "product_type")
          const parts = metafieldName.split('.');
          const namespace = parts[0] || '';
          const key = parts.slice(1).join('.') || parts[0] || '';
          
          const metafieldVariables = { 
            id: variant.id,
            identifiers: [{ namespace: namespace, key: key }]
          };
          
          // @ts-ignore - shopify.query accepts variables as second parameter
          const metafieldResponse = await shopify.query(metafieldQuery, { variables: metafieldVariables });
          
          if (!metafieldResponse.errors) {
            // @ts-ignore - Response structure from Storefront API
            const variantWithMetafields = metafieldResponse.data?.node;
            
            if (variantWithMetafields && variantWithMetafields.metafields) {
              variantsWithMetafields.push({
                ...variant,
                metafields: variantWithMetafields.metafields
              });
            } else {
              variantsWithMetafields.push({
                ...variant,
                metafields: []
              });
            }
          } else {
            console.error(`[Metafield Retrieval] GraphQL errors fetching metafields for variant ${variant.id}:`, metafieldResponse.errors);
            console.error(`[Metafield Retrieval] Full error details:`, JSON.stringify(metafieldResponse.errors, null, 2));
            variantsWithMetafields.push({
              ...variant,
              metafields: []
            });
          }
        } catch (err) {
          console.error(`[Metafield Retrieval] Exception fetching metafields for variant ${variant.id}:`, err);
          variantsWithMetafields.push({
            ...variant,
            metafields: []
          });
        }
      }
      
      // Update product with variants that include metafields
      const productWithMetafields = {
        ...product,
        variants: {
          edges: variantsWithMetafields.map(v => ({ node: v }))
        }
      };
      
      return productWithMetafields;
    } catch (error) {
      console.error(`[Metafield Retrieval] Exception caught in fetchProductWithVariantsFromAPI:`, error);
      console.error(`[Metafield Retrieval] Error stack:`, error.stack);
      return null;
    }
  }

  /**
   * Fetches variant metafields via Storefront API by fetching the product first
   * @param {string} variantId - Variant GID (e.g., "gid://shopify/ProductVariant/123")
   * @param {string} productId - Product GID (optional, will be extracted from variant if not provided)
   * @returns {Promise<Array>} Array of metafields
   */
  async function fetchVariantMetafieldsFromAPI(variantId, productId = null) {
    try {
      if (!variantId) {
        return [];
      }

      // If productId is not provided, try to extract it from variantId or fetch via node
      let actualProductId = productId;
      
      if (!actualProductId) {
        // Try to get product ID from the variant via node query
        const variantQuery = `
          query getVariantProduct($id: ID!) {
            node(id: $id) {
              ... on ProductVariant {
                id
                product {
                  id
                }
              }
            }
          }
        `;
        
        const variantVariables = { id: variantId };
        // @ts-ignore - shopify.query accepts variables as second parameter
        const variantResponse = await shopify.query(variantQuery, { variables: variantVariables });
        
        if (!variantResponse.errors) {
          // @ts-ignore - Response structure from Storefront API
          const variant = variantResponse.data?.node;
          actualProductId = variant?.product?.id;
        } else {
          console.error(`[Metafield Retrieval] Error fetching product ID from variant:`, variantResponse.errors);
        }
      }

      if (!actualProductId) {
        return [];
      }

      // Fetch the product with all variants, passing the metafield name we're looking for
      const product = await fetchProductWithVariantsFromAPI(actualProductId, conditionalMetafieldName);
      
      if (!product) {
        return [];
      }

      // Find the matching variant
      const variants = product.variants?.edges || [];
      
      const variantNode = variants.find(v => v.node.id === variantId);
      
      if (!variantNode) {
        return [];
      }

      // Metafields are already an array directly, not in edges structure
      const metafields = variantNode.node.metafields || [];
      // Metafields are already in the correct format (array of objects), return directly
      return metafields;
    } catch (error) {
      console.error(`[Metafield Retrieval] Exception caught in fetchVariantMetafieldsFromAPI:`, error);
      console.error(`[Metafield Retrieval] Error stack:`, error.stack);
      return [];
    }
  }

  /**
   * Retrieves MetaObjects of a specific type using Storefront API directly
   * No backend needed - uses api_access capability
   * 
   * @param {Object} options - Parameters for filtering MetaObjects
   * @param {string} options.type - MetaObject type (REQUIRED by Storefront API)
   * @param {number} [options.limit] - Maximum number of MetaObjects to retrieve (default: 250)
   * @returns {Promise<Object>} GraphQL response with MetaObjects
   */
  async function getAllShopMetaObjectsFromStorefront(options) {
    try {
      const {
        type,
        limit = 250
      } = options || {};

      if (!type) {
        throw new Error("Type parameter is required for Storefront API MetaObjects query");
      }

      const query = `
        query getMetaObjects($first: Int!, $type: String!) {
          metaobjects(first: $first, type: $type) {
            edges {
              node {
                id
                type
                handle
                fields {
                  key
                  value
                }
                updatedAt
              }
            }
          }
        }
      `;

      const variables = {
        first: limit,
        type: type
      };

      // Use shopify.query() method for Storefront API access
      // @ts-ignore - shopify.query accepts variables as second parameter
      const response = await shopify.query(query, { variables });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      // @ts-ignore - Response structure from Storefront API
      return response.data?.metaobjects || { edges: [] };
    } catch (error) {
      console.error("Error fetching MetaObjects from Storefront API:", error);
      throw error;
    }
  }

  async function handleClick() {
    // 4. Call the API to modify checkout
    const result = await shopify.applyAttributeChange({
      key: "requestedFreeGift",
      type: "updateAttribute",
      value: "yes",
    });
  }

  // 3. Render a UI
  // Check if content should be rendered based on conditional settings
  if (!shouldRender) {
    return null; // Don't render anything if condition is not met
  }

  return (
    <s-box>
      <s-stack gap="base">
          {/* Validation Error Banner - Shows when customer is not logged in */}
          {validationError && (
            <s-banner tone="critical">
              <s-text>{validationError}</s-text>
            </s-banner>
          )}
          
          {/* Configurable Title */}
          {sectionTitle && (
           
              <s-heading>{sectionTitle}</s-heading>
   
          )}
          
          {loading && (
            <s-text>Loading MetaObjects...</s-text>
          )}
          
          {error && (
            <s-banner tone="critical">
              <s-text>{error}</s-text>
            </s-banner>
          )}
          
          {!loading && !error && metaObjects.length > 0 && (
            <s-stack gap="base">
              {metaObjects.map((metaObject, index) => (
                <s-box key={metaObject.id || index}>
                  <s-stack gap="base">
                    {/* Display MetaObject fields/content */}
                    {metaObject.fields && Array.isArray(metaObject.fields) && metaObject.fields.length > 0 ? (
                      [...metaObject.fields].reverse().map((field, fieldIndex) => {
                        const isTitle = field.key && field.key.toLowerCase().includes('title');
                        return (
                          <s-stack key={fieldIndex} gap="base">
                            {isTitle ? (
                              <s-heading>{String(field.value || 'N/A')}</s-heading>
                            ) : (
                              <s-text>{String(field.value || 'N/A')}</s-text>
                            )}
                          </s-stack>
                        );
                      })
                    ) : (
                      <s-text>No fields available for this MetaObject</s-text>
                    )}
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          )}
          
          {!loading && !error && metaObjects.length === 0 && (
            <s-text>No MetaObjects found in the shop.</s-text>
          )}
          
          {/* Configurable Text */}
          {sectionText && (
            <s-text>{sectionText}</s-text>
          )}
      </s-stack>
    </s-box>
  );

  /**
   * Retrieves all MetaObjects from the admin shop via backend endpoint
   * MetaObjects are structured content objects that merchants can create and manage
   * 
   * @param {string} backendUrl - Your backend API endpoint URL (e.g., "https://your-app.com")
   * @param {Object} [options] - Optional parameters for filtering MetaObjects
   * @param {string} [options.type] - Filter by MetaObject type (e.g., "page", "blog", "custom_type")
   * @param {number} [options.limit] - Maximum number of MetaObjects to retrieve (default: 250)
   * @returns {Promise<Object>} Object containing array of all MetaObjects
   */
  async function getAllShopMetaObjects(backendUrl, options = {}) {
    try {
      const {
        type = null,
        limit = 250
      } = options || {};

      const url = new URL(`${backendUrl}/api/admin/metaobjects`);
      
      // Add query parameters if provided
      if (type) {
        url.searchParams.append("type", type);
      }
      url.searchParams.append("limit", limit.toString());
      
      
      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch shop MetaObjects: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (fetchError) {
        console.error("Fetch error details:", fetchError);
        console.error("Error name:", fetchError.name);
        console.error("Error message:", fetchError.message);
        console.error("Error stack:", fetchError.stack);
        throw fetchError;
      }
    } catch (error) {
      console.error("Error fetching all shop MetaObjects:", error);
      throw error;
    }
  }

  /**
   * Retrieves all MetaObjects of a specific type from the admin shop
   * 
   * @param {string} backendUrl - Your backend API endpoint URL
   * @param {string} type - The MetaObject type (e.g., "page", "blog", "custom_type")
   * @param {number} limit - Maximum number of MetaObjects to retrieve (default: 250)
   * @returns {Promise<Object>} Object containing array of MetaObjects for the specified type
   */
  async function getMetaObjectsByType(backendUrl, type, limit = 250) {
    return getAllShopMetaObjects(backendUrl, { type, limit });
  }

  /**
   * Retrieves a specific MetaObject by its ID
   * 
   * @param {string} backendUrl - Your backend API endpoint URL
   * @param {string} metaObjectId - The MetaObject ID (GID format)
   * @returns {Promise<Object>} The MetaObject data
   */
  async function getMetaObjectById(backendUrl, metaObjectId) {
    try {
      // Ensure metaObjectId is in GID format
      let formattedId = metaObjectId;
      if (!metaObjectId.startsWith("gid://")) {
        formattedId = `gid://shopify/Metaobject/${metaObjectId}`;
      }
      
      const url = new URL(`${backendUrl}/api/admin/metaobjects/${encodeURIComponent(formattedId)}`);
      
      
      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch MetaObject: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (fetchError) {
        console.error("Fetch error details:", fetchError);
        console.error("Error name:", fetchError.name);
        console.error("Error message:", fetchError.message);
        console.error("Error stack:", fetchError.stack);
        throw fetchError;
      }
    } catch (error) {
      console.error("Error fetching MetaObject by ID:", error);
      throw error;
    }
  }
}