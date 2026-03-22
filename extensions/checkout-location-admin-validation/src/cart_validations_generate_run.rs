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
    
    // Check customer metafield checkoutblocks.trigger
    // If it's set to "admin" (case-insensitive), the customer is allowed.
    let is_admin = cart
        .buyer_identity()
        .and_then(|identity| identity.customer())
        .and_then(|customer| customer.trigger())
        .map(|metafield| metafield.value().trim().eq_ignore_ascii_case("admin"))
        .unwrap_or(false);

    log!("Customer checkoutblocks.trigger (admin?) -> {}", is_admin);

    // Only add validation errors during checkout completion step
    // This applies to both "Pay now" and "Submit for review" orders
    if is_checkout_completion {
        // Block non-admin customers
        if !is_admin {
            let error_message = "אינך מורשה רכישה להזמנה זו".to_string();
            errors.push(schema::ValidationError {
                message: error_message,
                target: "$.cart".to_owned(),
            });
            log!("Blocking purchase - customer is not admin (checkoutblocks.trigger != 'admin')");
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

        log!("Added {} validation errors during checkout completion", errors.len());
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
