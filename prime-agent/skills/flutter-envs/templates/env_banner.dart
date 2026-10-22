import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

{{#envImport}}
import '{{path}}';

{{/envImport}}
/// Shows NAME top-left, ENVLESS when it is empty, and nothing in production.
class EnvBanner extends StatelessWidget {
  const EnvBanner({
    super.key,
    this.child,
    this.name = {{nameExpr}},
    this.flavor = appFlavor,
    this.guard = {{guard}},
  });

  static const production = '{{production}}';

  final Widget? child;
  final String name;
  final String? flavor;
  final bool guard;

  @override
  Widget build(BuildContext context) {
    final app = child ?? const SizedBox.shrink();
    final current = name.trim();
    if (current.toUpperCase() == production.toUpperCase()) return app;
    if (guard &&
        flavor != null &&
        current.isNotEmpty &&
        current.toUpperCase() != flavor!.toUpperCase()) {
      return Banner(
        message: 'MISMATCH',
        color: Colors.red,
        location: BannerLocation.topStart,
        textDirection: TextDirection.ltr,
        layoutDirection: TextDirection.ltr,
        child: app,
      );
    }
    return Banner(
      message: current.isEmpty ? 'ENVLESS' : current,
      location: BannerLocation.topStart,
      textDirection: TextDirection.ltr,
      layoutDirection: TextDirection.ltr,
      child: app,
    );
  }
}
