import 'package:flutter/material.dart';

OutlineInputBorder roundedInputBorder(
  double radius, {
  BorderSide side = const BorderSide(),
}) =>
    OutlineInputBorder(borderRadius: BorderRadius.circular(radius), borderSide: side);

/// Keeps button loading indicators at the same size as their usual icon.
class ButtonProgressIndicator extends StatelessWidget {
  const ButtonProgressIndicator({super.key, this.size = 20, this.color = Colors.white});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: size,
        child: CircularProgressIndicator(strokeWidth: 2, color: color),
      );
}
