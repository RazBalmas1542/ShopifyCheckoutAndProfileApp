use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let mut operations = Vec::new();
    let mut errors = Vec::new();

    // Check buyer journey step - only apply validation during checkout completion
    // This allows customers to proceed through checkout and only blocks at the final step
    // Validation applies to both "Pay now" and "Submit for review" orders
    let buyer_journey = input.buyer_journey();
    let buyer_step = buyer_journey.step();
    
    // Only apply validation during CHECKOUT_COMPLETION step
    // This applies to both "Pay now" and "Submit for review" orders
    let is_checkout_completion = buyer_step.map(|step| {
        matches!(
            step,
            schema::BuyerJourneyStep::CheckoutCompletion
        )
    }).unwrap_or(false);
    
    log!("Buyer journey step: {:?}, Is checkout completion: {}", buyer_step, is_checkout_completion);

    let cart = input.cart();
    
    // Get the customer's email from buyer identity
    let customer_email = cart.buyer_identity()
        .and_then(|identity| identity.email())
        .map(|email| email.to_lowercase());
    
    log!("Customer email: {:?}", customer_email);
    
    // Access the admin_emails cart attribute
    // Cart attributes store key-value pairs, admin_emails contains comma-separated email addresses
    // Example: "rbalmas@deloitte.co.il,avidalal@deloitte.co.il"
    let (admin_emails_list, admin_emails_text, raw_value, log_info) = if let Some(attribute) = cart.admin_emails() {
        let key = attribute.key();
        let value = attribute.value();
        
        // Handle the case where value might be None
        let raw_attribute_value = value.map(|v| v.to_string()).unwrap_or_else(|| "".to_string());
        
        // Extract emails from the attribute value
        // The value is a comma-separated string like "rbalmas@deloitte.co.il,avidalal@deloitte.co.il"
        let admin_emails_vec: Vec<String> = if let Some(attr_value) = value {
            attr_value
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect()
        } else {
            Vec::new()
        };
        
        let emails_text = if !admin_emails_vec.is_empty() {
            admin_emails_vec.join(", ")
        } else {
            "no admin emails were found".to_string()
        };
        
        // Capture log information to display in error
        let log_data = format!(
            "LOG: Cart attribute found | Key: {} | Value: {} | Admin Emails: {}",
            key, raw_attribute_value, emails_text
        );
        
        log!("Admin emails cart attribute found - Key: {}, Value: {:?}, Emails: {:?}", key, value, admin_emails_vec);
        
        (admin_emails_vec, emails_text, Some(raw_attribute_value), Some(log_data))
    } else {
        let log_data = "LOG: WARNING - No admin_emails cart attribute found".to_string();
        log!("WARNING: No admin_emails cart attribute found");
        (Vec::new(), "no admin emails were found".to_string(), None, Some(log_data))
    };
    
    // Check if customer's email is in the admin emails list
    // Normalize emails: trim whitespace and convert to lowercase for comparison
    let is_admin = if let Some(ref email) = customer_email {
        let normalized_customer_email = email.trim().to_lowercase();
        let found = admin_emails_list.iter().any(|admin_email| {
            let normalized_admin_email = admin_email.trim().to_lowercase();
            normalized_customer_email == normalized_admin_email
        });
        
        // Detailed logging for debugging
        log!("Email comparison - Customer: '{}' (normalized: '{}')", email, normalized_customer_email);
        for admin_email in &admin_emails_list {
            let normalized_admin = admin_email.trim().to_lowercase();
            let matches = normalized_customer_email == normalized_admin;
            log!("  vs Admin: '{}' (normalized: '{}') -> Match: {}", admin_email, normalized_admin, matches);
        }
        log!("Final result - Is admin: {}", found);
        
        found
    } else {
        log!("No customer email found");
        false
    };
    
    log!("Customer email: {:?}, Is admin: {}, Admin emails: {:?}", customer_email, is_admin, admin_emails_list);

    // Only add validation errors during checkout completion step
    // This applies to both "Pay now" and "Submit for review" orders
    // Only block if admin emails list is not empty AND customer's email is NOT in the admin emails list
    if is_checkout_completion {
        // If admin emails list is empty, allow all purchases (no restrictions)
        if admin_emails_list.is_empty() {
            log!("Allowing purchase - admin emails list is empty, no restrictions");
        } else if !is_admin {
            // Admin emails list exists and customer's email is not in the list - block the purchase
            let customer_email_str = customer_email.as_deref().unwrap_or("not provided");
            // Error message in Hebrew: "You are not authorized to purchase this order"
            let error_message = "אינך מורשה רכישה להזמנה זו".to_string();
            
            // Add error that will block checkout
            errors.push(schema::ValidationError {
                message: error_message,
                target: "$.cart".to_owned(),
            });
            
            log!("Blocking purchase - customer email not in admin emails list");
        } else {
            log!("Allowing purchase - customer email is in admin emails list");
        }

        // Existing validation logic - only during checkout
        if input
            .cart()
            .lines()
            .iter()
            .map(|line| *line.quantity())
            .any(|quantity| quantity > 1)
        {
            errors.push(schema::ValidationError {
                message: "Not possible to order more than one of each".to_owned(),
                target: "$.cart".to_owned(),
            })
        }
        
        let error_count = errors.len();
        log!("Added {} validation errors that should block checkout", error_count);
    } else {
        log!("Skipping validation - buyer is not in checkout completion step (current step: {:?})", buyer_step);
    }
    
    // Always return operations, even if empty (for cart interactions)
    // During checkout, errors will be present and will block
    let error_count = errors.len();
    let operation = schema::ValidationAddOperation { errors };
    operations.push(schema::Operation::ValidationAdd(operation));
    
    log!("Returning {} operations with {} total errors", operations.len(), error_count);

    Ok(schema::CartValidationsGenerateRunResult { operations })
}
