#include <rclcpp/rclcpp.hpp>

class Fixture : public rclcpp::Node {
public:
  Fixture() : Node("fixture") {
    scan_sub_ = create_subscription<sensor_msgs::msg::LaserScan>(
      "/scan", 10, [](auto) {});
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("/cmd_vel", 10);
    declare_parameter<double>("controller_frequency", 20.0);
    const auto dynamic_topic = make_topic();
    dynamic_sub_ = create_subscription<sensor_msgs::msg::LaserScan>(
      dynamic_topic, 10, [](auto) {});
  }
};
