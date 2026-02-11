use shopify_function::prelude::*;
use shopify_function::Result;

#[typegen("schema.graphql")]
pub mod schema {
    #[query("src/cart_validations_generate_run.graphql")]
    pub mod cart_validations_generate_run {}
}

#[shopify_function]
pub fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let mut operations = Vec::new();
    let mut errors = Vec::new();

    // Configuration values (can be made configurable later via shopify.extension.toml settings)
    let location_admins_name = "Location Admins";
    let error_message = "Only customers in the 'Location Admins' location are allowed to place orders. Please contact your administrator.";
    let login_required_message = "You must be logged in to complete this purchase. Please sign in to continue.";

    // Check if customer is logged in
    let cart = input.cart();
    
    // First, check if customer is logged in
    // For guest checkout, either buyer_identity is None OR customer() is None
    let is_logged_in = cart
        .buyer_identity()
        .and_then(|bi| bi.customer())
        .is_some();
    
    if !is_logged_in {
        // Customer is not logged in (guest checkout), block payment
        errors.push(schema::ValidationError {
            message: login_required_message.to_owned(),
            target: "$.cart".to_owned(),
        });
    } else {
        // Customer is logged in, check company and location
        if let Some(buyer_identity) = cart.buyer_identity() {
            if let Some(purchasing_company) = buyer_identity.purchasing_company() {
                let location = purchasing_company.location();
                let location_name = location.name();
                
                // Validate that the customer is in the "Location Admins" location
                if location_name.trim() != location_admins_name.trim() {
                    errors.push(schema::ValidationError {
                        message: error_message.to_owned(),
                        target: "$.cart".to_owned(),
                    });
                }
            } else {
                // Customer is logged in but not associated with a company, show error
                errors.push(schema::ValidationError {
                    message: error_message.to_owned(),
                    target: "$.cart".to_owned(),
                });
            }
        }
    }

    let operation = schema::ValidationAddOperation { errors };
    operations.push(schema::Operation::ValidationAdd(operation));

    Ok(schema::CartValidationsGenerateRunResult { operations })
}

