import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:{{package}}/env/env_banner.dart';

const production = '{{production}}';
const appKey = Key('app');

Future<void> pumpApp(
  WidgetTester tester, {
  required String name,
  required String? flavor,
  bool guard = true,
  TextDirection direction = TextDirection.ltr,
}) {
  return tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      builder: (context, child) => Directionality(
        textDirection: direction,
        child: EnvBanner(
          name: name,
          flavor: flavor,
          guard: guard,
          child: child,
        ),
      ),
      home: const SizedBox(key: appKey),
    ),
  );
}

Banner shownBanner(WidgetTester tester) {
  expect(find.byType(Banner), findsOneWidget);
  return tester.widget<Banner>(find.byType(Banner));
}

void main() {
  testWidgets('an empty NAME shows ENVLESS, not MISMATCH', (tester) async {
    await pumpApp(tester, name: '', flavor: 'dev', guard: true);
    expect(shownBanner(tester).message, 'ENVLESS');
  });

  testWidgets('sits top-left under a right-to-left locale', (tester) async {
    await pumpApp(
      tester,
      name: 'DEV',
      flavor: 'dev',
      direction: TextDirection.rtl,
    );
    final banner = shownBanner(tester);
    expect(banner.location, BannerLocation.topStart);
    expect(banner.textDirection, TextDirection.ltr);
    expect(banner.layoutDirection, TextDirection.ltr);
  });

  testWidgets('hides in production, trimmed and in any case', (tester) async {
    final names = [production, production.toLowerCase(), ' $production '];
    for (final name in names) {
      await pumpApp(tester, name: name, flavor: production.toLowerCase());
      expect(find.byType(Banner), findsNothing, reason: 'NAME "$name"');
    }
    await pumpApp(tester, name: production, flavor: 'dev');
    expect(find.byType(Banner), findsNothing, reason: 'flavor dev');
  });

  testWidgets('a named environment shows its NAME', (tester) async {
    for (final flavor in ['dev', null]) {
      await pumpApp(tester, name: 'DEV', flavor: flavor, guard: true);
      expect(shownBanner(tester).message, 'DEV', reason: 'flavor $flavor');
    }
  });

  testWidgets('a NAME naming another flavor shows MISMATCH', (tester) async {
    await pumpApp(tester, name: 'QA', flavor: 'dev', guard: true);
    expect(shownBanner(tester).message, 'MISMATCH');
    expect(shownBanner(tester).color, Colors.red);
    await pumpApp(tester, name: 'QA', flavor: production.toLowerCase());
    expect(shownBanner(tester).message, 'MISMATCH');
    await pumpApp(tester, name: 'QA', flavor: 'dev', guard: false);
    expect(shownBanner(tester).message, 'QA');
  });

  testWidgets('keeps the app rendered, production included', (tester) async {
    for (final name in [production, '', 'DEV', 'QA']) {
      await pumpApp(tester, name: name, flavor: 'dev', guard: true);
      expect(find.byKey(appKey), findsOneWidget, reason: 'NAME "$name"');
    }
  });
}
