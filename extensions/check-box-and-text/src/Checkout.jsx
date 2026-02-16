import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useState} from "preact/hooks";

// Export the extension
export default async () => {
  render(<Extension />, document.body)
};

function Extension() {
  // Get checkbox settings from admin configuration
  // @ts-ignore - Settings structure varies by extension
  const checkboxText = (shopify.settings?.current?.checkbox_text || shopify.settings?.checkbox_text || "").trim();
  // @ts-ignore - Settings structure varies by extension - checkbox_required may not be in type definition
  const settingsCurrent = shopify.settings?.current || {};
  // @ts-ignore
  const settingsRoot = shopify.settings || {};
  // @ts-ignore - Using bracket notation to access dynamic property
  const checkboxRequired = settingsCurrent['checkbox_required'] !== undefined 
    ? settingsCurrent['checkbox_required'] 
    : (settingsRoot['checkbox_required'] !== undefined ? settingsRoot['checkbox_required'] : false);
  // @ts-ignore - Using bracket notation to access dynamic property
  const checkboxRequiredMessage = (settingsCurrent['checkbox_required_message'] || settingsRoot['checkbox_required_message'] || "This field is required.").trim();
  // @ts-ignore - Using bracket notation to access dynamic property
  const checkboxCheckedByDefault = settingsCurrent['checkbox_checked_by_default'] !== undefined 
    ? settingsCurrent['checkbox_checked_by_default'] 
    : (settingsRoot['checkbox_checked_by_default'] !== undefined ? settingsRoot['checkbox_checked_by_default'] : false);

  // Initialize checkbox state based on "Checked by Default" setting
  const [checkboxChecked, setCheckboxChecked] = useState(checkboxCheckedByDefault);
  // Track if user has interacted with the checkbox
  const [hasInteracted, setHasInteracted] = useState(false);

  // Don't render if no text is provided
  if (!checkboxText) {
    return null;
  }

  return (
    <s-box>
      <s-stack gap="base">
        {/* @ts-ignore - Grid component type resolution */}
        <s-grid
          gridTemplateColumns="auto 1fr"
          alignItems="start"
          gap="base"
        >
          <s-checkbox
            checked={checkboxChecked}
            onChange={(value) => {
              // Mark that user has interacted with the checkbox
              setHasInteracted(true);
              // Handle both boolean and event object
              if (typeof value === 'boolean') {
                setCheckboxChecked(value);
              } else {
                // @ts-ignore - Event object handling
                const checked = value?.target?.checked ?? !checkboxChecked;
                setCheckboxChecked(checked);
              }
            }}
          />
          <s-text>{checkboxText}</s-text>
        </s-grid>
        {checkboxRequired && !checkboxChecked && hasInteracted && (
          <s-text tone="critical">
            {checkboxRequiredMessage}
          </s-text>
        )}
      </s-stack>
    </s-box>
  );
}