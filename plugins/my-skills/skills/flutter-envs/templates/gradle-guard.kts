gradle.taskGraph.whenReady {
    listOf({{list}}).forEach { flavor ->
        val needed = allTasks.any { it.name.contains(flavor.replaceFirstChar(Char::uppercase)) && it.name.contains("GoogleServices") }
        if (needed && !file("src/$flavor/google-services.json").exists()) {
            throw GradleException(
                "android/app/src/$flavor/google-services.json is missing. " +
                    "CI writes it from GOOGLE_SERVICES_JSON_${flavor.uppercase()}; locally, run /flutter-envs."
            )
        }
    }
}
