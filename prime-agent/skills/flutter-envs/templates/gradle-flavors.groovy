flavorDimensions "env"
productFlavors {
{{#flavors}}
    {{name}} {
        dimension "env"
        applicationId "{{id}}"
    }
{{/flavors}}
}
