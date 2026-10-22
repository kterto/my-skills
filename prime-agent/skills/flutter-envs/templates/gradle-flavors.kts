flavorDimensions += "env"
productFlavors {
{{#flavors}}
    create("{{name}}") {
        dimension = "env"
        applicationId = "{{id}}"
    }
{{/flavors}}
}
