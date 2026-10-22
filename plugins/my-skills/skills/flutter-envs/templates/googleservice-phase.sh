set -eu
ENV_NAME="${CONFIGURATION##*-}"
if [ "${ENV_NAME}" = "${CONFIGURATION}" ]; then echo "error: build configuration ${CONFIGURATION} names no environment (expected <Mode>-<env>)" >&2; exit 1; fi
SOURCE="${PROJECT_DIR}/config/${ENV_NAME}/GoogleService-Info.plist"
if [ ! -f "${SOURCE}" ]; then echo "error: ${SOURCE} is missing. CI writes it from GOOGLE_SERVICE_INFO_PLIST_$(printf '%s' "${ENV_NAME}" | tr '[:lower:]' '[:upper:]'); locally, run /flutter-envs." >&2; exit 1; fi
cp "${SOURCE}" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"
