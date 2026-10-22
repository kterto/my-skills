gradle.taskGraph.whenReady { graph ->
    [{{list}}].each { flavor ->
        def needed = graph.allTasks.any { it.name.contains(flavor.capitalize()) && it.name.contains('GoogleServices') }
        if (needed && !file("src/${flavor}/google-services.json").exists()) {
            throw new GradleException("android/app/src/${flavor}/google-services.json is missing. CI writes it from GOOGLE_SERVICES_JSON_${flavor.toUpperCase()}; locally, run /flutter-envs.")
        }
    }
}
